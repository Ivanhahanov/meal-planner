"use client"
import React, { useState } from 'react';
import { Modal, Input, Button, Select, AutoComplete, List, Typography, Tag, Row, Col } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Option } = Select;
const { Text } = Typography;
const units = ['г', 'кг', 'мл', 'л', 'шт', 'зубч', 'ст.л', 'ч.л'];
const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
const RANGE = process.env.NEXT_PUBLIC_GOOGLE_SHEET_RANGE || 'Recipes!A1:J';

const NewDishModal = ({ visible, onCancel, onAddDish, allIngredients, mealTypes, categories, preferences, cuisines }) => {
  const { token, login } = useAuth();
  const [name, setName] = useState('');
  const [cookingTime, setCookingTime] = useState(0);
  const [handsOnTime, setHandsOnTime] = useState(0);
  const [type, setType] = useState([]);
  const [category, setCategory] = useState([]);
  const [preference, setPreference] = useState([]);
  const [cuisine, setCuisine] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [ingredientName, setIngredientName] = useState('');
  const [ingredientQuantity, setIngredientQuantity] = useState('');
  const [ingredientUnit, setIngredientUnit] = useState('г');
  const [loading, setLoading] = useState(false);
  
  const resetForm = () => {
    setName('');
    setCookingTime(0);
    setHandsOnTime(0);
    setType([]);
    setCategory([]);
    setPreference([]);
    setCuisine([]);
    setIngredients([]);
    setIngredientName('');
    setIngredientQuantity('');
    setIngredientUnit('г');
  };

  const handleAddIngredient = () => {
    if (ingredientName && ingredientQuantity && ingredientUnit) {
      setIngredients([
        ...ingredients,
        {
          name: ingredientName,
          quantity: parseFloat(ingredientQuantity),
          unit: ingredientUnit
        },
      ]);
      setIngredientName('');
      setIngredientQuantity('');
      setIngredientUnit('г');
    }
  };

  const handleAddDish = async () => {
    if (!name || cookingTime <= 0 || handsOnTime <= 0 || ingredients.length === 0) {
      Modal.error({
        title: 'Ошибка',
        content: 'Заполните все обязательные поля корректно',
      });
      return;
    }

    setLoading(true);

    try {
      if (!token) {
        await login();
        if (!token) throw new Error('Авторизация не выполнена');
      }

      // Подготовка данных с новыми полями
      const values = ingredients.map(ing => [
        name,
        cookingTime,
        handsOnTime,
        type.join(','),
        category.join(','),
        preference.join(','),
        cuisine.join(','),
        ing.name,
        ing.quantity,
        ing.unit
      ]);

      // Отправка запроса
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Ошибка сохранения');
      }

      // Обновление локального состояния
      const newDish = {
        name,
        cookingTime: Number(cookingTime),
        handsOnTime: Number(handsOnTime),
        type,
        category,
        preference,
        cuisine,
        ingredients: ingredients.map(ing => ({
          ...ing,
          quantity: Number(ing.quantity)
        }))
      };

      onAddDish(newDish);
      resetForm();
      onCancel();
    } catch (error) {
      Modal.error({
        title: 'Ошибка',
        content: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const capitalizeFirstLetter = (val) => {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}

  return (
    <Modal
      title="Добавить новое блюдо"
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Отмена
        </Button>,
        <Button
          key="add"
          type="primary"
          onClick={handleAddDish}
          loading={loading}
        >
          Добавить
        </Button>,
      ]}
    >
       <Input
        placeholder="Название блюда*"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginBottom: '16px' }}
      />

      <Row gutter={16}>
        <Col span={12}>
          <div style={{ marginBottom: '16px' }}>
            <span>Общее время (мин)*: </span>
            <Input
              type="number"
              min="1"
              value={cookingTime}
              onChange={(e) => setCookingTime(Math.max(1, parseInt(e.target.value, 10)))}
              style={{ width: '100%' }}
            />
          </div>
        </Col>
        <Col span={12}>
          <div style={{ marginBottom: '16px' }}>
            <span>Активное время (мин)*: </span>
            <Input
              type="number"
              min="1"
              value={handsOnTime}
              onChange={(e) => setHandsOnTime(Math.max(1, parseInt(e.target.value, 10)))}
              style={{ width: '100%' }}
            />
          </div>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <div style={{ marginBottom: '16px' }}>
            <span>Тип приема пищи: </span>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              value={type}
              onChange={setType}
              options={mealTypes.map(t => ({ value: t }))}
            />
          </div>
        </Col>
        <Col span={12}>
          <div style={{ marginBottom: '16px' }}>
            <span>Категория: </span>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              value={category}
              onChange={setCategory}
              options={categories.map(c => ({ value: c }))}
            />
          </div>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <div style={{ marginBottom: '16px' }}>
            <span>Предпочтения: </span>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              value={preference}
              onChange={setPreference}
              options={preferences.map(p => ({ value: p }))}
            />
          </div>
        </Col>
        <Col span={12}>
          <div style={{ marginBottom: '16px' }}>
            <span>Кухня: </span>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              value={cuisine}
              onChange={setCuisine}
              options={cuisines.map(c => ({ value: c }))}
            />
          </div>
        </Col>
      </Row>

      <div style={{ marginBottom: '16px' }}>
        <AutoComplete
          options={allIngredients.map(i => ({ value: i }))}
          placeholder="Ингредиент"
          value={ingredientName}
          onChange={(value) => setIngredientName(value)}
          filterOption={(input, option) =>
            option.value.toLowerCase().includes(input.toLowerCase())
          }
          style={{ width: '50%', marginRight: '8px' }}
        />
        <Input
          placeholder="Кол-во"
          type="number"
          step={1}
          min={1}
          value={ingredientQuantity}
          onChange={(e) => {
            const value = Math.max(0.1, parseFloat(e.target.value)) || '';
            setIngredientQuantity(value);
          }}
          style={{ width: '20%', marginRight: '8px' }}
        />
        <Select
          value={ingredientUnit}
          onChange={(value) => setIngredientUnit(value)}
          style={{ width: '20%' }}
        >
          {units.map((unit) => (
            <Option key={unit} value={unit}>
              {unit}
            </Option>
          ))}
        </Select>
        <Button
          onClick={handleAddIngredient}
          style={{ marginTop: '8px' }}
          disabled={!ingredientName || !ingredientQuantity}
        >
          Добавить ингредиент
        </Button>
      </div>

      <List
        size="small"
        dataSource={ingredients}
        renderItem={(item, index) => (
          <List.Item
            className="flex items-center justify-between"
            actions={[
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => setIngredients(prev => prev.filter((_, i) => i !== index))}
              />
            ]}
          >
            <div className="flex items-center gap-2">
              <Text className="font-medium">{capitalizeFirstLetter(item.name)}</Text>
              <Tag>{item.quantity} {item.unit}</Tag>
            </div>
          </List.Item>
        )}
      />
    </Modal>
  );
};

export default NewDishModal;