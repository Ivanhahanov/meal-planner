"use client"
import { useState, useEffect } from 'react';
import { Modal, Input, List, Card, Button, Typography, Flex, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Text } = Typography;
const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
const INGREDIENTS_RANGE = process.env.NEXT_PUBLIC_GOOGLE_SHEET_INGREDIENTS_RANGE || 'Convert!A1:E';

const PerekrestokRuleModal = ({ visible, ingredient, onSave, onCancel, authKey, mapping }) => {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rulePreview, setRulePreview] = useState(null);

  useEffect(() => {
    if (visible && ingredient) {
      setQuery(ingredient.name);
      handleSearch(ingredient.name);
      initializeExistingRule();
    } else {
      resetForm();
    }
  }, [visible]);

  const getProductMeta = (product) => {
    const md = product.masterData;
    let unit, packageSize, isPackage = "yes";

    if (md.weight && !md.volume) {
      unit = 'г';
      packageSize = md.weight;
    } else if (md.weight && md.volume) {
      unit = 'мл';
      packageSize = md.volume;
    } else {
      unit = md.unitName === 'кг' ? 'г' : md.unitName;
      packageSize = md.quantumStep;
      isPackage = "no"
    }

    return {
      unit: unit,
      packageSize: packageSize,
      isPackage: isPackage
    };
  };

  const initializeExistingRule = () => {
    const existingRule = mapping[ingredient.name];
    if (existingRule) {
      setRulePreview(existingRule);
    }
  };

  const resetForm = () => {
    setSelectedProduct(null);
    setRulePreview(null);
    setResults([]);
  };

  const handleSearch = async (searchQuery) => {
    if (!searchQuery) return;

    try {
      setLoading(true);
      const response = await fetch('https://www.perekrestok.ru/api/customer/1.4.1.0/catalog/product/feed', {
        method: 'POST',
        headers: {
          'auth': authKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          page: 1,
          perPage: 48,
          filter: { textQuery: searchQuery },
          withBestProductReviews: false
        })
      });

      const data = await response.json();
      setResults(data.content?.items || []);

    } catch (error) {
      console.error('Search error:', error);
      message.error('Ошибка поиска товаров');
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (product) => {
    const productMeta = getProductMeta(product);
    setSelectedProduct(product);
    setRulePreview({
      name: ingredient.name,
      id: product.id,
      packageSize: productMeta.packageSize,
      unit: productMeta.unit,
      isPackage: productMeta.isPackage,
    });
  };

  const updateRulePreview = (values) => {
    if (!selectedProduct) return;

    setRulePreview({
      name: ingredient.name,
      id: selectedProduct.id,
      ...values
    });
  };

  const handleSave = async () => {
    if (!rulePreview) return;

    try {
      const getResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${INGREDIENTS_RANGE}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      const data = await getResponse.json();
      const existingValues = data.values || [];

      const filteredValues = existingValues.filter(row => row[0] !== ingredient.name);
      const newRow = [
        ingredient.name,
        rulePreview.id,
        rulePreview.packageSize.toString(),
        rulePreview.unit,
        rulePreview.isPackage
      ];

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${INGREDIENTS_RANGE}?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [...filteredValues, newRow] })
        }
      );

      message.success('Правило успешно сохранено!');
      onSave(rulePreview);
      onCancel();
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      message.error('Ошибка сохранения правила');
    }
  };

  const calculateConversion = () => {
    if (!rulePreview || !ingredient) return '';
    const { packageSize, unit } = rulePreview;
    const packages = Math.ceil(ingredient.quantity / packageSize);
    return `${packages}×${packageSize}${unit}`;
  };

  const getSaleInfo = (product) => {
    const md = product.masterData;
    if (md.weight && !md.volume) {
      return `Упаковка: ${md.weight}г`;
    }
    if (md.weight && md.volume) {
      return `Упаковка: ${md.volume}мл`;
    }
    return `Продаётся на развес (шаг: ${md.quantumStep}${md.unitName === 'кг' ? 'г' : md.unitName})`;
  };

  return (
    <Modal
      title={`Правило для: ${ingredient?.name} (${ingredient?.quantity}${ingredient?.unit})`}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={800}
      destroyOnClose
    >
      <Flex vertical gap={16}>
        <Flex gap={8} align="center">
          <Input
            placeholder="Поиск продуктов..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            prefix={<SearchOutlined />}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => handleSearch(query)}
            loading={loading}
          >
            Найти
          </Button>
        </Flex>
        {rulePreview && (
          <Flex gap={8} vertical style={{ marginBottom: 16 }}>
            <Text strong>Правило конвертации:</Text>
            <Flex gap={8} wrap="wrap">
              <Text type="secondary">ID: {rulePreview.id}</Text>
              <Text type="secondary">|</Text>
              <Text type="secondary">{calculateConversion()}</Text>
            </Flex>
            <Button type="primary" onClick={handleSave} block loading={loading}>
              Сохранить правило
            </Button>
          </Flex>
        )}

        <List
          grid={{ gutter: 16, xs: 1, column: 3 }}
          dataSource={results}
          loading={loading}
          renderItem={item => (
            <List.Item>
              <Card
                onClick={() => handleProductSelect(item)}
                style={{
                  border: selectedProduct?.id === item.id ? '2px solid #1890ff' : undefined,
                  cursor: 'pointer',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <img
                    src={item.image?.cropUrlTemplate?.replace('%s', '200x200') || ''}
                    alt={item.title}
                    style={{
                      width: '100%',
                      height: 160,
                      minHeight: 160,
                      objectFit: 'contain',
                      marginBottom: 8
                    }}
                  />

                  <Text
                    strong
                  >
                    {item.title}
                  </Text>
                  <Flex vertical gap={4} style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 14 }}>
                      Рейтинг: {item.rating / 100}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                      {getSaleInfo(item)}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                      Цена: {(item.priceTag?.price / 100).toFixed(2)}₽
                    </Text>
                  </Flex>
                </div>
              </Card>
            </List.Item>
          )}
        />
      </Flex>
    </Modal>
  );
};

export default PerekrestokRuleModal;