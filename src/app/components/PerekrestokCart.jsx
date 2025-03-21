"use client"
import { useState, useEffect, useRef } from 'react';
import { Input, Button, List, Space, Typography, Spin, Statistic, Tag, Collapse } from 'antd';
import { InfoCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, EditOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { pluralize } from '../helpers/pluralize'
import PerekrestokRuleModal from './PerekrestokRuleModal';

const { Text } = Typography;
const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
const INGREDIENTS_RANGE = process.env.NEXT_PUBLIC_GOOGLE_SHEET_INGREDIENTS_RANGE || 'Convert!A1:E';

const PerekrestokCart = ({ ingredients }) => {
  const { token } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [unconvertedIngredients, setUnconvertedIngredients] = useState([]);
  const [cartData, setCartData] = useState(null);
  const [items, setItems] = useState({});
  const [mapping, setMapping] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const initialLoad = useRef(true);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${INGREDIENTS_RANGE}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );

        const data = await response.json();
        const mappingData = data.values?.slice(1).reduce((acc, row) => ({
          ...acc,
          [row[0]]: {
            id: row[1],
            packageSize: parseFloat(row[2]),
            unit: row[3],
            isPackage: row[4]
          }
        }), {}) || {};

        setMapping(mappingData);
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (initialLoad.current) {
      loadData();
      initialLoad.current = false;
    }
  }, [token]);

  const handleSaveRule = async (rule) => {
    try {
      // Обновляем локальное состояние
      setMapping(prev => ({
        ...prev,
        [rule.name]: rule
      }));

      setModalVisible(false);
      convertIngredients();
    } catch (error) {
      console.error('Ошибка сохранения правила:', error);
    }
  };

  const convertIngredients = () => {
    const converted = [];
    const unconverted = [];

    ingredients.forEach(ingredient => {
      // Проверяем наличие правила конвертации для ингредиента
      const rule = mapping[ingredient.name];
      if (!rule) {
        unconverted.push(ingredient);
        return;
      }

      // Проверяем поддерживаемые единицы измерения
      let requiredBase;
      switch (ingredient.unit) {
        case 'кг':
          requiredBase = ingredient.quantity * 1000; // Конвертируем кг в граммы
          break;
        case 'г':
          requiredBase = ingredient.quantity;
          break;
        case 'л':
          requiredBase = ingredient.quantity * 1000; // Конвертируем литры в миллилитры
          break;
        case 'мл':
          requiredBase = ingredient.quantity;
          break;
        case 'шт':
          requiredBase = ingredient.quantity; // Штучные товары
          break;
        default:
          unconverted.push(ingredient); // Неподдерживаемая единица измерения
          return;
      }

      // Обрабатываем специальные правила для разных типов продуктов
      let packageSize = rule.packageSize;

      // Конвертация литров в миллилитры для расчетов
      if (rule.unit.toLowerCase() === 'л' && !isPieces) {
        packageSize *= 1000;
      }

      let packages, amount, isPackage;

      
      packages = Math.ceil(requiredBase / packageSize);
      isPackage = rule.isPackage === "yes" ? true: false
      amount = isPackage ? packages * 1000 : requiredBase;

      // Формируем объект конвертированного продукта
      const convertedIngredient = {
        id: rule.id,
        name: ingredient.name,
        originalName: ingredient.name,
        amount: amount,
        cost: 0,
        unit: rule.unit,
        packageSize: packageSize,
        required: ingredient.quantity,
        originalUnit: ingredient.unit,
        packages: packages,
        isPackage: isPackage,
      };
      console.log(convertedIngredient, ingredient, requiredBase)

      converted.push(convertedIngredient);
    });

    // Обновляем состояния
    setProducts(converted);
    setUnconvertedIngredients(unconverted);
  };

  useEffect(() => {
    if (Object.keys(mapping).length > 0) convertIngredients();
  }, [ingredients, mapping]);

  useEffect(() => {
    setItems(Object.fromEntries(
      products.map(p => [p.id, { ...p, status: 'initial', amount: p.amount }])
    ));
  }, [products]);

  const updateOperation = (id, status, message = '', amount) => {
    setItems(prev => ({
      ...prev,
      [id]: { ...prev[id], status, message, amount: amount ?? prev[id]?.amount }
    }));
  };

  const processItem = async (id, amount) => {
    try {
      updateOperation(id, 'processing', '', amount);
      const response = await fetch(`https://www.perekrestok.ru/api/customer/1.4.1.0/basket/${id}/amount`, {
        method: 'PUT',
        headers: { 'auth': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount) })
      });

      if (!response.ok) {
        const errorData = await response.json();
        // TODO: add exception for QUANTITY_BIGGER_THAN_STOCK 
        if (response.status === 412 && errorData.error?.code === 'OUT_OF_STOCK') {
          updateOperation(id, 'error', 'Нет в наличии', amount);
          return;
        }
        throw new Error(errorData.error?.message || 'Unknown API error');
      }

      const data = await response.json();
      setItems(prev => {
        const newItems = { ...prev };
        const ourProductIds = new Set(products.map(p => Number(p.id)));

        data.content?.items?.forEach(item => {
          const productId = item.product?.id;
          if (!productId) return;

          const isOutOfStock = item.state === 'out_of_stock' ||
            item.product.balanceState === 'sold-out' ||
            item.cost === 0;

          if (ourProductIds.has(productId)) {
            newItems[productId] = {
              ...prev[productId],
              title: item.product.title,
              cost: item.cost / 100 || 0,
              amount: item.amount || 0,
              status: isOutOfStock ? 'error' : 'success',
              message: isOutOfStock ? 'Нет в наличии' : '',
              isExternal: false
            };
          } else {
            const masterData = item.product.masterData;
            const quantumStep = masterData.quantumStep || 1000;
            let displayAmount;
            let displayUnit;

            switch (masterData.unitName) {
              case 'кг':
                displayUnit = 'г';
                displayAmount = item.amount;
                break;
              case 'л':
                displayUnit = 'мл';
                displayAmount = item.amount;
                break;
              case 'шт':
                displayUnit = 'шт';
                displayAmount = item.amount / quantumStep;
                break;
              default:
                displayUnit = masterData.unitName;
                displayAmount = item.amount;
            }

            newItems[productId] = {
              id: productId,
              title: item.product.title,
              cost: item.cost / 100 || 0,
              amount: displayAmount,
              status: isOutOfStock ? 'error' : 'success',
              message: isOutOfStock ? 'Нет в наличии' : '',
              isExternal: true,
              unit: displayUnit,
              packageSize: quantumStep
            };
          }
        });
        return newItems;
      });

      setCartData(prev => ({
        ...prev,
        invoice: data.content?.invoice ? {
          ...data.content.invoice,
          summaryCost: data.content.invoice.summaryCost || prev?.invoice?.summaryCost
        } : prev?.invoice
      }));
    } catch (error) {
      updateOperation(id, 'error', error.message, amount);
    }
  };

  const handleBulkUpdate = async () => {
    setLoading(true);
    for (const id of products.map(p => p.id)) {
      await processItem(id, items[id].amount);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    setLoading(false);
  };

  const statusIcon = (status, message) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'error':
        return (
          <Space>
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
            <Text type="danger">{message}</Text>
          </Space>
        );
      case 'processing':
        return <Spin size="small" />;
      default:
        return <span style={{ opacity: 0.5 }}>Ожидает</span>;
    }
  };

  const renderItem = (item) => (
    <List.Item>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        width: '100%'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 4,
          flexWrap: 'wrap'
        }}>
          {!item.isExternal &&
            <Button
              icon={<EditOutlined />}
              size='small'
              type="text"
              onClick={() => {
                setSelectedIngredient({ ...item, quantity: item.required });
                setModalVisible(true);
              }}
              disabled={apiKey === ''}
            />
          }
          <Text
            strong
            delete={item.status === 'error'}
            style={{
              flex: 1,
              minWidth: '60%',
              wordBreak: 'break-word',
              whiteSpace: 'normal'
            }}
          >
            {item.title || item.name}
          </Text>

          {/* Цена и статус в одной строке */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0
          }}>
            {item.cost !== 0 && item.status !== 'error' && (
              <Text
                strong
                style={{
                  whiteSpace: 'nowrap',
                  fontSize: 14
                }}
              >
                {item.cost}₽
              </Text>
            )}
            <div style={{ flexShrink: 0 }}>
              {statusIcon(item.status, item.message)}
            </div>
          </div>
        </div>

        {/* Детали продукта */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap'
        }}>
          {item.isExternal && (
            <Tag
              color="green"
              style={{
                margin: 0,
                flexShrink: 0,
                fontSize: 12
              }}
            >
              Из корзины
            </Tag>
          )}

          <Text
            type="secondary"
            delete={item.status === 'error'}
            style={{
              fontSize: 12,
              whiteSpace: 'nowrap'
            }}
          >
            {item.isExternal ? `${item.amount} ${item.unit}` : `${item.required}${item.originalUnit} → ${item.packages}×${item.packageSize}${item.unit}`}
          </Text>
        </div>
      </div>
    </List.Item>
  );

  return (
    <Spin
      spinning={isLoading}
      tip="Загрузка данных для конвертации..."
      size="large"
    >
      <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
        <Input
          placeholder="API ключ Перекресток"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          suffix={
            <InfoCircleOutlined
              onClick={() => alert('API ключ можно получить в личном кабинете Перекрестка')}
              style={{ color: 'rgba(0,0,0,.45)' }}
            />
          }
        />
        <List
          dataSource={Object.values(items)}
          renderItem={renderItem}
        />

        {unconvertedIngredients.length > 0 && (
          <Collapse
            items={[
              {
                key: '1',
                label: `Не удалось конвертировать ${unconvertedIngredients.length} ${pluralize("ингредиент", unconvertedIngredients.length)}`,
                children: (
                  <List
                    size="small"
                    dataSource={unconvertedIngredients}
                    renderItem={item => (
                      <List.Item>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>

                          <Text>{item.name}</Text>

                          <div>
                            <Text type="secondary">{item.quantity} {item.unit}</Text>
                            <Button
                              icon={<EditOutlined />}
                              onClick={() => {
                                setSelectedIngredient(item);
                                setModalVisible(true);
                              }}
                              disabled={apiKey === ''}
                              style={{ marginLeft: 8 }}
                            />
                          </div>
                        </Space>
                      </List.Item>
                    )}
                  />
                ),
                className: 'unconverted-panel',
                showArrow: true
              }
            ]}
          />
        )}

        {cartData?.invoice?.summaryCost && (
          <div style={{ textAlign: 'right' }}>
            <Statistic
              title="Итого"
              value={(cartData.invoice.summaryCost / 100).toFixed(2)}
              suffix="₽"
              precision={2}
            />
            <Text type="secondary">
              {cartData.invoice.itemNumber} {pluralize("товар", cartData.invoice.itemNumber)} ·
              Доставка {cartData.invoice.deliveryCost === 0 ? 'бесплатно' :
                `${(cartData.invoice.deliveryCost / 100).toFixed(2)} ₽`}
            </Text>
          </div>
        )}

        <Button
          type="primary"
          block
          onClick={handleBulkUpdate}
          loading={loading}
          disabled={!apiKey || products.length === 0}
        >
          Сформировать корзину в Перекрестке
        </Button>
      </Space>
      <PerekrestokRuleModal
        visible={modalVisible}
        ingredient={selectedIngredient}
        mapping={mapping}
        onSave={handleSaveRule}
        onCancel={() => setModalVisible(false)}
        authKey={apiKey}
      />
    </Spin>
  );
};

export default PerekrestokCart;