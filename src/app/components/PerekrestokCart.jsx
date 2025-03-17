"use client"
import { useState, useEffect, useRef } from 'react';
import { Input, Button, List, Space, Typography, Spin, Statistic } from 'antd';
import { InfoCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Text } = Typography;

const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
const INGREDIENTS_RANGE = process.env.NEXT_PUBLIC_GOOGLE_SHEET_INGREDIENTS_RANGE || 'Convert!A2:E';
const CACHE_KEY = 'perekrestok_mapping_cache';

const PerekrestokCart = ({ ingredients }) => {
  const { token } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [cartData, setCartData] = useState(null);
  const [items, setItems] = useState({});
  const [mapping, setMapping] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const initialLoad = useRef(true);

  // Загрузка и кэширование данных
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
      const converted = ingredients
        .map(ingredient => {
          const rule = mapping[ingredient.name];
          if (!rule) return null;

          let requiredBase;
          // Конвертируем все в базовые единицы (граммы или миллилитры)
          switch (ingredient.unit) {
            case 'кг':
              requiredBase = ingredient.quantity * 1000; // кг → г
              break;
            case 'г':
              requiredBase = ingredient.quantity;
              break;
            case 'л':
              requiredBase = ingredient.quantity * 1000; // литры → мл
              break;
            case 'мл':
              requiredBase = ingredient.quantity;
              break;
            case 'шт':
              requiredBase = ingredient.quantity;
              break;
            default:
              return null;
          }

          // Определяем тип конвертации
          const isLiquid = ['л', 'мл'].includes(rule.unit);
          const isWeight = ['кг', 'г'].includes(rule.unit);
          const isPieces = rule.unit === 'шт';

          // Нормализуем packageSize для жидкостей
          let packageSize = rule.packageSize;
          if (isLiquid && rule.unit === 'л') {
            packageSize *= 1000; // конвертируем литры в мл
          }

          // Рассчитываем необходимое количество упаковок
          let packages;
          if (rule.rounding === 'exact') {
            packages = requiredBase / packageSize;
          } else {
            packages = Math.ceil(requiredBase / packageSize);
          }

          // Рассчитываем amount для API
          let amount;
          if (isPieces) {
            // 1 шт в API = 1000 единиц
            amount = packages * 1000;
          } else if (isLiquid) {
            // Для жидкостей используем мл напрямую
            amount = packages * packageSize;
          } else {
            // Для весовых товаров используем граммы
            amount = packages * packageSize;
          }

          // Формируем объект продукта
          return {
            id: rule.id,
            name: ingredient.name,
            originalName: ingredient.name,
            amount: amount,
            unit: rule.unit,
            packageSize: rule.packageSize,
            required: ingredient.quantity,
            originalUnit: ingredient.unit,
            packages: packages,
            convertedUnit: isLiquid ? 'мл' : 'г'
          };
        })
        .filter(Boolean);

      setProducts(converted);
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
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data = await response.json();

      setItems(prev => {
        const newItems = { ...prev };
        data.content?.items?.forEach(item => {
          if (item.product?.id) {
            newItems[item.product.id] = {
              ...prev[item.product.id],
              id: item.product.id,
              price: item.price / 100 || 0,
              amount: item.amount || 0,
              status: 'success'
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

  const statusIcon = (status) => {
    switch (status) {
      case 'success': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'error': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'processing': return <Spin size="small" />;
      default: return <span style={{ opacity: 0.5 }}>Ожидает</span>;
    }
  };

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
          renderItem={item => (
            <List.Item>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <div>
                  <Text strong>{item.name}</Text>
                  <br />
                  <Text type="secondary">
                    {item.packageSize === 1
                      ? `${item.required}${item.unit}`
                      : `${item.required}g → ${item.packages} уп. × ${item.packageSize}g`}
                  </Text>
                </div>
                <Space>
                  {item.price && (
                    <Text strong>{(item.price * (item.amount / 1000)).toFixed(2)} ₽</Text>
                  )}
                  {statusIcon(item.status)}
                </Space>
              </Space>
            </List.Item>
          )}
        />

        {cartData?.invoice?.summaryCost && (
          <div style={{ textAlign: 'right' }}>
            <Statistic
              title="Итого"
              value={(cartData.invoice.summaryCost / 100).toFixed(2)}
              suffix="₽"
              precision={2}
            />
            <Text type="secondary">
              {cartData.invoice.itemNumber} товаров ·
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