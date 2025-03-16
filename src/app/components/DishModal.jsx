import React from 'react';
import {
  Modal,
  List,
  Tag,
  Row,
  Col,
  Typography,
  Divider,
  Button,
  Card,
  Tooltip,
  Space,
  Grid
} from 'antd';
import {
  ClockCircleOutlined,
  UserOutlined,
  AppstoreOutlined,
  FilterOutlined,
  FireOutlined,
  GlobalOutlined,
  PlusOutlined,
  MinusOutlined,
  DeleteOutlined
} from '@ant-design/icons';

const { Text } = Typography;
const { useBreakpoint } = Grid;

const TAG_CONFIG = {
  type: { icon: <AppstoreOutlined />, color: 'blue' },
  category: { icon: <FilterOutlined />, color: 'green' },
  preference: { icon: <FireOutlined />, color: 'orange' },
  cuisine: { icon: <GlobalOutlined />, color: 'purple' }
};


const DishModal = ({
  dish,
  visible,
  onClose,
  isViewMode = false,
  servings = 1,
  updateServings,
  day,
  removeDishFromDay
}) => {

  const screens = useBreakpoint();
  const unitConversions = {
    'г': { type: 'weight', baseUnit: 'кг', factor: 0.001 },
    'кг': { type: 'weight', baseUnit: 'кг', factor: 1 },
    'мл': { type: 'volume', baseUnit: 'л', factor: 0.001 },
    'л': { type: 'volume', baseUnit: 'л', factor: 1 },
    'шт': { type: 'count', baseUnit: 'шт', factor: 1 },
  };

  const getDisplayUnitAndQuantity = (quantity, unit = 'шт') => {
    const conversion = unitConversions[unit] || unitConversions['шт'];
    const baseQuantity = quantity * conversion.factor;

    if (conversion.type === 'weight') {
      if (baseQuantity >= 1) {
        return { unit: 'кг', quantity: parseFloat(baseQuantity.toFixed(2)) };
      }
      return { unit: 'г', quantity: parseFloat((baseQuantity * 1000).toFixed(2)) };
    }

    if (conversion.type === 'volume') {
      if (baseQuantity >= 1) {
        return { unit: 'л', quantity: parseFloat(baseQuantity.toFixed(2)) };
      }
      return { unit: 'мл', quantity: parseFloat((baseQuantity * 1000).toFixed(2)) };
    }

    return { unit, quantity };
  };

  const calculateAdjustedIngredient = (ingredient) => {
    const scaledQuantity = ingredient.quantity * servings;
    const { quantity, unit } = getDisplayUnitAndQuantity(
      scaledQuantity,
      ingredient.unit
    );

    return {
      ...ingredient,
      displayQuantity: quantity,
      displayUnit: unit
    };
  };

  // Обновленная функция для обновления порций
  const handleUpdateServings = (newServings) => {
    if (newServings < 1) return;
    updateServings(day, dish.name, newServings);
  };

  const handleRemoveDish = () => {
    removeDishFromDay(day, dish.name);
    onClose();
  };

  return (
    <Modal
      title={null}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
      closable={false}
      styles={{ body: { padding: 0 } }}
      className="recipe-modal"
      responsive
    >
      <Card
        style={{
          background: 'linear-gradient(135deg, #f8f9fa 0%, #fff 100%)',
          borderRadius: 0,
          padding: 16
        }}
        styles={{body: {padding:0, margin:0}}}
      >
        {/* Основной контейнер */}
        <Row
          gutter={[12, 8]}
          align="middle"
          wrap={false}
        >
          {/* Блок с эмоджи */}
          <Col flex="none">
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 8,
              background: '#f1f3f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              marginRight: 12
            }}>
              🍝
            </div>
          </Col>

          {/* Центральный блок с названием и тегами */}
          <Col flex="auto">
            <Text strong style={{ fontSize: 18, display: 'block' }}>
              {dish.name}
            </Text>
            <div style={{
              marginTop: 8,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8
            }}>
              <Tag
                icon={<ClockCircleOutlined />}
                color="default"
                style={{ margin: 0, borderRadius: 6 }}
              >
                {dish.cookingTime} мин
              </Tag>
              {dish.handsOnTime && (
                <Tag
                  icon={<UserOutlined />}
                  color="default"
                  style={{ borderRadius: 6 }}
                >
                  {dish.handsOnTime} мин
                </Tag>
              )}
            </div>
          </Col>
        </Row>
        
        {/* Блок с кнопками управления */}
        {!isViewMode && (
        <Row
          style={{
            marginTop: screens.xs ? 16 : 0,
            width: '100%'
          }}
          justify={screens.xs ? "space-between" : "end"}
        >
          <Space.Compact>
            <Tooltip title="Уменьшить порции">
              <Button
                icon={<MinusOutlined />}
                onClick={() => handleUpdateServings(servings - 1)}
                disabled={servings <= 1}
              />
            </Tooltip>
            <Button style={{ pointerEvents: 'none' }}>{servings}</Button>
            <Tooltip title="Увеличить порции">
              <Button
                icon={<PlusOutlined />}
                onClick={() => handleUpdateServings(servings + 1)}
              />
            </Tooltip>
          </Space.Compact>

          <Tooltip title="Удалить блюдо">
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleRemoveDish}
              style={{ marginLeft: screens.xs ? 0 : 8 }}
            />
          </Tooltip>
        </Row>
        )}
      </Card>

      <div style={{ padding: 16 }}>
        <Divider orientation="left" orientationMargin={0} plain>
          Ингредиенты на {servings} {servings === 1 ? 'порцию' : servings >= 2 && servings <= 4 ? 'порции' : 'порций'}
        </Divider>

        <List
          size="small"
          dataSource={dish.ingredients.map(calculateAdjustedIngredient)}
          renderItem={(ingredient) => (
            <List.Item style={{ padding: '8px 0' }}>
              <Row gutter={12} style={{ width: '100%' }}>
                <Col span={8}>
                  <Text type="secondary">
                    {ingredient.displayQuantity} {ingredient.displayUnit}
                  </Text>
                </Col>
                <Col span={16}>
                  <Text>{ingredient.name}</Text>
                </Col>
              </Row>
            </List.Item>
          )}
        />
        {/* Остальная часть кода остается без изменений */}
        <Divider orientation="left" orientationMargin={0} plain>
          Характеристики
        </Divider>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 16
        }}>
          {Object.entries(TAG_CONFIG).map(([key, config]) =>
            dish[key]?.map((value, index) => (
              <Tag
                key={`${key}-${index}`}
                icon={config.icon}
                color={config.color}
                style={{
                  margin: 0,
                  borderRadius: 6,
                  flexShrink: 0
                }}
              >
                {value}
              </Tag>
            ))
          )}
        </div>

        <Button
          type="default"
          block
          onClick={onClose}
          style={{
            borderRadius: 6,
            color: '#666',
            borderColor: '#ddd'
          }}
        >
          Закрыть
        </Button>
      </div>
    </Modal>
  );
};

export default DishModal;