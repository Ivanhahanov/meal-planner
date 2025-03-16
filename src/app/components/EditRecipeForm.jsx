

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
  Space,
  Grid
} from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext'

const { Option } = Select;
const { useBreakpoint } = Grid;
const units = ['г', 'кг', 'мл', 'л', 'шт', 'зубч', 'ст.л', 'ч.л'];

const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
const RANGE = process.env.NEXT_PUBLIC_GOOGLE_SHEET_RANGE || 'Recipes!A1:J';

const EditRecipeForm = ({
  recipe,
  onSave,
  onCancel,
  allIngredients,
  mealTypes = [],
  categories = [],
  preferences = [],
  cuisines = []
}) => {
  const { token, login } = useAuth();
  const [form] = Form.useForm();
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [originalName, setOriginalName] = useState('');
  const screens = useBreakpoint();

  useEffect(() => {
    if (recipe) {
      setOriginalName(recipe.name);
      setIngredients(recipe.ingredients || []);
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

  const handleAddIngredient = () => {
    setIngredients(prev => [...prev, { name: '', quantity: 1, unit: 'г' }]);
  };

  const handleRemoveIngredient = (index) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const ingredientOptions = allIngredients.map(ing => ({ value: ing }));


  const isMobile = screens.xs;
  const mobileStyle = isMobile ? { width: '100%' } : {};

  return (
    <Form form={form} layout="vertical">
      {/* Название рецепта */}
      <Form.Item
        name="name"
        label="Название рецепта"
        rules={[{ required: true, message: 'Введите название' }]}
      >
        <Input placeholder="Название блюда" />
      </Form.Item>

      {/* Время приготовления - компактный ряд */}
      <Row >
        <Col span={12}>
          <Form.Item
            name="cookingTime"
            label="Общее время (мин)"
            rules={[{ required: true, message: 'Укажите время' }]}
          >
            <InputNumber
              min={1}
              style={{ width: '95%' }}
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
        </Col>
      </Row>

      <Row gutter={12}>
        <Col span={12}>
          <Form.Item name="type" label="Тип приема пищи">
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              maxTagCount="responsive"
              options={mealTypes.map(t => ({ value: t, label: t }))} 
            />
          </Form.Item>
        </Col>
        
        <Col span={12}>
          <Form.Item name="category" label="Категория блюда">
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              maxTagCount="responsive"
              options={categories.map(c => ({ value: c, label: c }))}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col span={12}>
          <Form.Item name="preference" label="Предпочтения">
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              maxTagCount="responsive"
              options={preferences.map(p => ({ value: p, label: p }))}
            />
          </Form.Item>
        </Col>
        
        <Col span={12}>
          <Form.Item name="cuisine" label="Тип кухни">
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              maxTagCount="responsive"
              options={cuisines.map(c => ({ value: c, label: c }))}
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Ингредиенты">
        {ingredients.map((ingredient, index) => (
          <div key={index} style={{ marginBottom: 12, width: '100%' }}>
            <Row
              gutter={[8, 8]}
              align="middle"
              style={{ width: '100%', margin: 0 }}
            >
              {/* Ингредиент */}
              <Col xs={11} md={8}>
                <AutoComplete
                  options={ingredientOptions}
                  placeholder="Ингредиент"
                  value={ingredient.name}
                  onChange={(value) => {
                    const newIngredients = [...ingredients];
                    newIngredients[index].name = value;
                    setIngredients(newIngredients);
                  }}
                  style={{ width: '100%' }}
                  filterOption={(inputValue, option) =>
                    option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                  }
                />
              </Col>

              {/* Количество */}
              <Col xs={5} md={4}>
                <InputNumber
                  min={1}
                  step={1}
                  value={ingredient.quantity}
                  onChange={(value) => {
                    const newIngredients = [...ingredients];
                    newIngredients[index].quantity = value;
                    setIngredients(newIngredients);
                  }}
                  style={{ width: '100%' }}
                />
              </Col>

              {/* Единицы измерения */}
              <Col xs={5} md={4}>
                <Select
                  value={ingredient.unit}
                  onChange={(value) => {
                    const newIngredients = [...ingredients];
                    newIngredients[index].unit = value;
                    setIngredients(newIngredients);
                  }}
                  style={{ width: '100%' }}
                >
                  {units.map(unit => (
                    <Option key={unit} value={unit}>{unit}</Option>
                  ))}
                </Select>
              </Col>

              {/* Кнопка удаления */}
              <Col xs={3} md={4}>
                <Button
                  danger
                  onClick={() => handleRemoveIngredient(index)}
                  icon={<DeleteOutlined />}
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
          </div>
        ))}

        <Button
          type="dashed"
          onClick={handleAddIngredient}
          icon={<PlusOutlined />}
          block
        >
          Добавить ингредиент
        </Button>
      </Form.Item>

      <Form.Item>
        <Space
          direction={isMobile ? 'vertical' : 'horizontal'}
          style={{ width: '100%' }}
        >
          <Button
            type="primary"
            onClick={handleSave}
            loading={loading}
            icon={<SaveOutlined />}
            block={isMobile}
          >
            Сохранить
          </Button>
          <Button
            onClick={onCancel}
            icon={<CloseOutlined />}
            block={isMobile}
          >
            Отмена
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default EditRecipeForm;