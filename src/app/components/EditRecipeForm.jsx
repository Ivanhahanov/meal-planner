"use client"
import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Button,
  Select,
  Modal,
  AutoComplete,
  Row,
  Col,
  Space
} from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext'

const { Option } = Select;
const units = ['г', 'кг', 'мл', 'л', 'шт', 'зубч', 'ст.л', 'ч.л'];
const mealTypes = ['Завтрак', 'Обед', 'Ужин'];
const categories = ['Основное', 'Гарнир', 'Салат', 'Супы'];
const preferences = ['Мясное', 'Рыбное', 'Вегетарианское', 'Веганское'];
const cuisines = ['Русская', 'Итальянская', 'Азиатская', 'Средиземноморская'];

const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
const RANGE = process.env.NEXT_PUBLIC_GOOGLE_SHEET_RANGE;

const EditRecipeForm = ({ recipe, onSave, onCancel, allIngredients }) => {
  const { token, login } = useAuth();
  const [form] = Form.useForm();
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [originalName, setOriginalName] = useState('');

  useEffect(() => {
    if (recipe) {
      setOriginalName(recipe.name);
      setIngredients(recipe.ingredients);
      form.setFieldsValue({
        name: recipe.name,
        cookingTime: recipe.cookingTime,
        handsOnTime: recipe.handsOnTime,
        type: recipe.type || [],
        category: recipe.category || [],
        preference: recipe.preference || [],
        cuisine: recipe.cuisine || []
      });
    }
  }, [recipe, form]);

  const handleAddIngredient = () => {
    setIngredients([...ingredients, { name: '', quantity: 1, unit: 'г' }]);
  };

  const handleRemoveIngredient = (index) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  // Автозаполнение для ингредиентов
  const ingredientOptions = allIngredients.map(ing => ({ value: ing }));

  const handleSave = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue();

      const updatedRecipe = {
        ...values,
        cookingTime: Number(values.cookingTime),
        handsOnTime: Number(values.handsOnTime),
        type: values.type || [],
        category: values.category || [],
        preference: values.preference || [],
        cuisine: values.cuisine || [],
        ingredients: ingredients.map(ing => ({
          ...ing,
          quantity: Number(ing.quantity)
        }))
      };
      setLoading(true);

      // 1. Получаем данные листа
      const sheetInfo = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets(properties,data.rowData.values(formattedValue))`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const sheetData = await sheetInfo.json();
      const sheetId = sheetData.sheets[0].properties.sheetId;

      // 2. Находим все строки для этого рецепта
      const rowsResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const { values: allRows } = await rowsResponse.json();

      // 3. Определяем индексы строк для удаления
      const deleteRowIndexes = allRows
        .map((row, index) => row[0] === originalName ? index : -1)
        .filter(index => index !== -1)
        .sort((a, b) => b - a); // Важно сортировать в обратном порядке

      // 4. Формируем запросы на удаление
      const deleteRequests = deleteRowIndexes.map(index => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: "ROWS",
            startIndex: index,
            endIndex: index + 1
          }
        }
      }));

      // 5. Формируем новые данные для добавления
      const newRows = updatedRecipe.ingredients.map(ing => [
        updatedRecipe.name,
        updatedRecipe.cookingTime,
        updatedRecipe.handsOnTime,
        updatedRecipe.type.join(','),
        updatedRecipe.category.join(','),
        updatedRecipe.preference.join(','),
        updatedRecipe.cuisine.join(','),
        ing.name,
        ing.quantity,
        ing.unit
      ]);

      // 6. Формируем запросы на добавление
      const appendRequest = {
        appendCells: {
          sheetId,
          rows: newRows.map(row => ({
            values: row.map(cellValue => ({
              userEnteredValue: typeof cellValue === 'number'
                ? { numberValue: cellValue }
                : { stringValue: cellValue.toString() }
            }))
          })),
          fields: "userEnteredValue"
        }
      };

      // 7. Собираем все запросы в один batch
      const requests = [...deleteRequests, appendRequest];

      // 8. Отправляем batch update
      const batchResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ requests })
        }
      );

      const batchData = await batchResponse.json();
      console.log('Batch Update Result:', batchData);

      if (!batchResponse.ok) {
        throw new Error(batchData.error?.message || 'Ошибка обновления данных');
      }

      // 9. Обновляем локальное состояние
      onSave(updatedRecipe);
      Modal.success({
        content: 'Рецепт успешно обновлен',
      });

    } catch (error) {
      console.error('Update Error:', error);
      Modal.error({
        title: 'Ошибка',
        content: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form form={form} layout="vertical">
      <Row gutter={16}>
        <Col span={24}>
          <Form.Item
            name="name"
            label="Название рецепта"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input placeholder="Название блюда" />
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item
            name="cookingTime"
            label="Общее время (мин)"
            rules={[{ required: true, message: 'Укажите время' }]}
          >
            <InputNumber
              min={1}
              style={{ width: '100%' }}
              placeholder="30"
            />
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item
            name="handsOnTime"
            label="Активное время (мин)"
            rules={[{ required: true, message: 'Укажите время' }]}
          >
            <InputNumber
              min={1}
              style={{ width: '100%' }}
              placeholder="15"
            />
          </Form.Item>
        </Col><Col span={24}>
          <Form.Item name="type" label="Тип приема пищи">
            <Select mode="multiple">
              {mealTypes.map(type => (
                <Option key={type} value={type}>{type}</Option>
              ))}
            </Select>
          </Form.Item>
        </Col>

        <Col span={24}>
          <Form.Item name="category" label="Категория блюда">
            <Select mode="multiple">
              {categories.map(cat => (
                <Option key={cat} value={cat}>{cat}</Option>
              ))}
            </Select>
          </Form.Item>
        </Col>

        <Col span={24}>
          <Form.Item name="preference" label="Предпочтения">
            <Select mode="multiple">
              {preferences.map(pref => (
                <Option key={pref} value={pref}>{pref}</Option>
              ))}
            </Select>
          </Form.Item>
        </Col>

        <Col span={24}>
          <Form.Item name="cuisine" label="Тип кухни">
            <Select mode="multiple">
              {cuisines.map(cuisine => (
                <Option key={cuisine} value={cuisine}>{cuisine}</Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Ингредиенты">
        {ingredients.map((ingredient, index) => (
          <div key={index} style={{ marginBottom: 12 }}>
            <Space align="start" style={{ width: '100%' }}>
              <AutoComplete
                options={ingredientOptions}
                placeholder="Ингредиент"
                value={ingredient.name}
                onChange={(value) => {
                  const newIngredients = [...ingredients];
                  newIngredients[index].name = value;
                  setIngredients(newIngredients);
                }}
                style={{ width: 200 }}
                filterOption={(inputValue, option) =>
                  option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                }
              />

              <InputNumber
                min={1}
                step={1}
                value={ingredient.quantity}
                onChange={(value) => {
                  const newIngredients = [...ingredients];
                  newIngredients[index].quantity = value;
                  setIngredients(newIngredients);
                }}
                style={{ width: 100 }}
              />

              <Select
                value={ingredient.unit}
                onChange={(value) => {
                  const newIngredients = [...ingredients];
                  newIngredients[index].unit = value;
                  setIngredients(newIngredients);
                }}
                style={{ width: 100 }}
              >
                {units.map(unit => (
                  <Option key={unit} value={unit}>{unit}</Option>
                ))}
              </Select>

              <Button
                danger
                onClick={() => handleRemoveIngredient(index)}
                icon={<DeleteOutlined />}
                shape="circle"
              />
            </Space>
          </div>
        ))}

        <Button
          type="dashed"
          onClick={handleAddIngredient}
          icon={<PlusOutlined />}
          style={{ width: '100%' }}
        >
          Добавить ингредиент
        </Button>
      </Form.Item>

      <Form.Item>
        <Space>
          <Button
            type="primary"
            onClick={handleSave}
            loading={loading}
            icon={<SaveOutlined />}
          >
            Сохранить
          </Button>
          <Button
            onClick={onCancel}
            icon={<CloseOutlined />}
          >
            Отмена
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default EditRecipeForm;