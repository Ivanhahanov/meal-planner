"use client"
import { useState, useEffect, useRef } from 'react';
import { Input, Button, List, Space, Typography, Spin, Statistic, Tag, Collapse } from 'antd';
import { InfoCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, CaretRightOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { pluralize } from '../helpers/pluralize'

const { Text } = Typography;
const { Panel } = Collapse;
const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
const INGREDIENTS_RANGE = process.env.NEXT_PUBLIC_GOOGLE_SHEET_INGREDIENTS_RANGE || 'Convert!A1:E';
const CACHE_KEY = 'perekrestok_mapping_cache';

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

  useEffect(() => {
    const loadData = async () => {
      try {
        const cachedData = sessionStorage.getItem(CACHE_KEY);
        if (cachedData) {
          setMapping(JSON.parse(cachedData));
          setIsLoading(false);
          return;
        }

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
            rounding: row[4]
          }
        }), {}) || {};

        sessionStorage.setItem(CACHE_KEY, JSON.stringify(mappingData));
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

  useEffect(() => {
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
        const isPieces = rule.unit.toLowerCase() === 'шт';
        let packageSize = rule.packageSize;

        // Конвертация литров в миллилитры для расчетов
        if (rule.unit.toLowerCase() === 'л' && !isPieces) {
          packageSize *= 1000;
        }

        let packages, amount, displayUnit;

        if (rule.rounding === 'exact') {
          // Продукты на развес без упаковки
          packages = 1;
          amount = requiredBase;
          displayUnit = ingredient.unit; // Сохраняем оригинальную единицу
        } else {
          // Расчет для упакованных продуктов
          packages = Math.ceil(requiredBase / packageSize);
          amount = isPieces ? packages * 1000 : packages * 1000;
          displayUnit = isPieces ? 'шт' : rule.unit.toLowerCase() === 'л' ? 'мл' : rule.unit;
        }

        // Формируем объект конвертированного продукта
        const convertedIngredient = {
          id: rule.id,
          name: ingredient.name,
          originalName: ingredient.name,
          amount: amount,
          price: 0,
          unit: displayUnit,
          packageSize: packageSize,
          required: ingredient.quantity,
          originalUnit: ingredient.unit,
          packages: packages,
          convertedUnit: displayUnit,
          isPieces: isPieces,
          isExact: rule.rounding === 'exact'
        };

        converted.push(convertedIngredient);
      });

      // Обновляем состояния
      setProducts(converted);
      setUnconvertedIngredients(unconverted);
    };

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
            item.price === 0;

          if (ourProductIds.has(productId)) {
            newItems[productId] = {
              ...prev[productId],
              title: item.product.title,
              price: item.price / 100 || 0,
              amount: item.amount || 0,
              status: isOutOfStock ? 'error' : 'success',
              message: isOutOfStock ? 'Нет в наличии' : '',
              isExternal: false
            };
          } else {
            newItems[productId] = {
              id: productId,
              title: item.product.title,
              price: item.price / 100 || 0,
              amount: item.amount || 0,
              status: isOutOfStock ? 'error' : 'success',
              message: isOutOfStock ? 'Нет в наличии' : '',
              isExternal: true,
              unit: item.product.masterData.unitName === 'кг' ? 'г' :
                item.product.masterData.unitName === 'л' ? 'мл' :
                  item.product.masterData.unitName,
              packageSize: item.product.masterData.quantum / 1000
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
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        flexWrap: 'nowrap'
      }}>
        {/* Левая часть - название и детали */}
        <div style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            flexWrap: 'wrap'
          }}>
            <Text
              strong
              delete={item.status === 'error'}
              style={{
                fontSize: 'clamp(14px, 3vw, 16px)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {item.title || item.name}
              {item.isExternal && (
                <Tag
                  color="blue"
                  style={{
                    marginLeft: 8,
                    flexShrink: 0,
                    fontSize: 'clamp(12px, 2.5vw, 14px)'
                  }}
                >
                  Внешний
                </Tag>
              )}
            </Text>
          </div>

          <Text
            type="secondary"
            delete={item.status === 'error'}
            style={{
              fontSize: 'clamp(12px, 2.5vw, 14px)',
              display: 'block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {item.isExternal
              ? `${item.amount} ${item.unit}`
              : item.isExact
                ? `${item.required} ${item.originalUnit}`
                : `${item.required}${item.originalUnit} → ${item.packages}×${item.packageSize}${item.convertedUnit}`}
          </Text>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
          marginLeft: 'auto',
          paddingLeft: 8
        }}>
          {item.price !== 0 && item.status !== 'error' && (
            <Text
              strong
              style={{
                fontSize: 'clamp(14px, 3vw, 16px)',
                whiteSpace: 'nowrap'
              }}
            >
              {(item.price * (item.amount / 1000)).toFixed(2)}₽
            </Text>
          )}
          <div style={{ flexShrink: 0 }}>
            {statusIcon(item.status, item.message)}
          </div>
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
                          <Text type="secondary">{item.quantity} {item.unit}</Text>
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
    </Spin>
  );
};

export default PerekrestokCart;