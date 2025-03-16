"use client"
import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Input,
  Select,
  Modal,
  Row,
  Col,
  Tag,
  message,
  List,
  Typography,
  Tooltip,
  Button,
  Pagination
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  FilterOutlined,
  ClockCircleOutlined,
  AppstoreOutlined,
  FireOutlined,
  GlobalOutlined,
  CloseOutlined
} from '@ant-design/icons';
import EditRecipeForm from './EditRecipeForm';
import DishModal from './DishModal'
import { useAuth } from '../context/AuthContext'

const { Search } = Input;
const { Option } = Select;
const { Text } = Typography;

const TAG_CONFIG = {
  type: { icon: <AppstoreOutlined />, color: 'blue' },
  category: { icon: <FilterOutlined />, color: 'green' },
  preference: { icon: <FireOutlined />, color: 'orange' },
  cuisine: { icon: <GlobalOutlined />, color: 'purple' }
};

const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
const RANGE = process.env.NEXT_PUBLIC_GOOGLE_SHEET_RANGE || 'Recipes!A1:J';

const RecipesList = ({ dishes, setDishes, allIngredients }) => {
  const { token, login } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [filtersVisible, setFiltersVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });

  const [selectedRecipe, setSelectedRecipe] = useState(null); // Состояние для выбранного рецепта
  const [isDishModalVisible, setIsDishModalVisible] = useState(false); 

   // Функция для открытия модального окна
   const handleCardClick = (recipe) => {
    setSelectedRecipe(recipe);
    setIsDishModalVisible(true);
  };

  // Функция для закрытия модального окна
  const handleDishModalClose = () => {
    setIsDishModalVisible(false);
    setSelectedRecipe(null);
  };

  const [filters, setFilters] = useState({
    cookingTime: null,
    ingredients: [],
    types: [],
    categories: [],
    preferences: [],
    cuisines: []
  });

  const filterOptions = useMemo(() => ({
    types: [...new Set(dishes.flatMap(d => d.type))],
    categories: [...new Set(dishes.flatMap(d => d.category))],
    preferences: [...new Set(dishes.flatMap(d => d.preference))],
    cuisines: [...new Set(dishes.flatMap(d => d.cuisine))]
  }), [dishes]);

  // Редактирование рецепта
  const handleEditRecipe = (recipe) => {
    setEditingRecipe(recipe);
    setIsEditModalVisible(true);
  };

  // Удаление рецепта
  const handleDeleteRecipe = (recipe) => {
    setRecipeToDelete(recipe);
    setIsDeleteModalVisible(true);
  };
  const handleConfirmDelete = async () => {
    try {
      setDeleteLoading(true)
      if (!token) {
        await login();
        if (!token) throw new Error('Авторизация не выполнена');
      }


      const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}`;
      const response = await fetch(getUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Ошибка получения данных');
      const data = await response.json();

      const rowsToDelete = data.values
        .map((row, index) => row[0] === recipeToDelete.name ? index + 1 : null)
        .filter(index => index !== null)
        .sort((a, b) => b - a);

      console.log('Найдены строки для удаления:', rowsToDelete);

      const deleteRequests = rowsToDelete.map(index => ({
        deleteDimension: {
          range: {
            sheetId: 0,
            dimension: "ROWS",
            startIndex: index - 1,
            endIndex: index
          }
        }
      }));

      const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`;
      const batchResponse = await fetch(batchUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests: deleteRequests })
      });

      if (!batchResponse.ok) throw new Error('Ошибка удаления');


      setDishes(prev => prev.filter(dish => dish.name !== recipeToDelete.name));
      message.success('Рецепт успешно удален');
    } catch (error) {
      message.error(error.message);
    } finally {
      setDeleteLoading(false)
      setIsDeleteModalVisible(false);
      setRecipeToDelete(null);
    }
  };

  const filteredDishes = useMemo(() => dishes.filter(dish => {
    const matchesSearch = dish.name.toLowerCase().includes(searchText.toLowerCase());
    const matchesTime = filters.cookingTime ? dish.cookingTime <= filters.cookingTime : true;
    const matchesIngredients = filters.ingredients.length === 0 ||
      filters.ingredients.every(ing => dish.ingredients.some(i => i.name === ing));

    const matchesFilters = [
      [filters.types, dish.type],
      [filters.categories, dish.category],
      [filters.preferences, dish.preference],
      [filters.cuisines, dish.cuisine]
    ].every(([selected, values]) =>
      selected.length === 0 || selected.some(s => values.includes(s))
    );

    return matchesSearch && matchesTime && matchesIngredients && matchesFilters;
  }), [dishes, searchText, filters]);


  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, filters]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredDishes.slice(start, end);
  }, [filteredDishes, currentPage, pageSize]);

  const renderTimeTags = (dish) => (
    <div style={{ display: 'flex' }}>
      <Tooltip title="Общее время">
        <Tag color="geekblue">
          <ClockCircleOutlined /> {dish.cookingTime}
        </Tag>
      </Tooltip>
      <Tooltip title="Активное время">
        <Tag color="cyan">
          <ClockCircleOutlined /> {dish.handsOnTime}
        </Tag>
      </Tooltip>
    </div>
  );

  const renderFilterSection = (title, icon, name, options) => (
    <div style={{ marginBottom: 16 }}>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>
        {icon} {title}
      </Text>
      <Select
        mode="multiple"
        placeholder={`Все ${title}`}
        options={options.map(o => ({ value: o }))}
        onChange={values => setFilters(f => ({ ...f, [name]: values }))}
        style={{ width: '100%' }}
        allowClear
        showSearch
        filterOption={(input, option) =>
          option.label.toLowerCase().includes(input.toLowerCase())
        }
      />
    </div>
  );

  return (
    <div>
      <Row gutter={24}>
        {/* Боковая панель фильтров */}
        {filtersVisible && (
          <Col xs={24} sm={24} md={8} lg={6}>
            <div style={{
              background: '#fff',
              padding: 16,
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              position: 'sticky',
              top: 16,
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16
              }}>
                <Text strong style={{ fontSize: 16 }}>
                  <FilterOutlined /> Фильтры
                </Text>
                <Button
                  icon={<CloseOutlined />}
                  onClick={() => setFiltersVisible(false)}
                  size="small"
                  type="text"
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <Search
                  placeholder="Поиск по названию"
                  allowClear
                  onChange={e => setSearchText(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              {renderFilterSection('Тип приема пищи', <AppstoreOutlined />, 'types', filterOptions.types)}
              {renderFilterSection('Категории', <FilterOutlined />, 'categories', filterOptions.categories)}
              {renderFilterSection('Предпочтения', <FireOutlined />, 'preferences', filterOptions.preferences)}
              {renderFilterSection('Кухни', <GlobalOutlined />, 'cuisines', filterOptions.cuisines)}

              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  <ClockCircleOutlined /> Время приготовления
                </Text>
                <Select
                  placeholder="Макс. время"
                  style={{ width: '100%' }}
                  onChange={value => setFilters(f => ({ ...f, cookingTime: value }))}
                  allowClear
                >
                  <Option value={15}>До 15 мин</Option>
                  <Option value={30}>До 30 мин</Option>
                  <Option value={45}>До 45 мин</Option>
                  <Option value={60}>До 60 мин</Option>
                </Select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  Ингредиенты
                </Text>
                <Select
                  mode="multiple"
                  placeholder="Фильтр по ингредиентам"
                  style={{ width: '100%' }}
                  options={allIngredients.map(ing => ({ value: ing }))}
                  onChange={values => setFilters(f => ({ ...f, ingredients: values }))}
                  allowClear
                />
              </div>
            </div>
          </Col>
        )}

        {/* Основное содержимое */}
        <Col xs={24} sm={24} md={filtersVisible ? 16 : 24} lg={filtersVisible ? 18 : 24}>
          {!filtersVisible && (
            <Button
              type="primary"
              icon={<FilterOutlined />}
              onClick={() => setFiltersVisible(true)}
              style={{ marginBottom: 16 }}
            >
              Показать фильтры
            </Button>
          )}

          <Row gutter={[16, 16]}>
            {paginatedData.map(dish => (
              <Col key={dish.name} xs={24} sm={12} lg={8} xl={8}>
                <Card
                  title={
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <Text
                        ellipsis={{ tooltip: dish.name }}
                        style={{
                          fontSize: 16,
                          fontWeight: 500
                        }}
                      >
                        {dish.name}
                      </Text>
                      {renderTimeTags(dish)}
                    </div>
                  }
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                  styles={{
                    body: {
                      flex: 1,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column'
                    }
                  }}
                  onClick={() => handleCardClick(dish)}
                  actions={[
                    <EditOutlined key="edit" onClick={() => handleEditRecipe(dish)} />,
                    <DeleteOutlined key="delete" onClick={() => handleDeleteRecipe(dish)} />
                  ]}
                  hoverable
                >
                  <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                    {Object.entries({
                      type: dish.type,
                      category: dish.category,
                      preference: dish.preference,
                      cuisine: dish.cuisine
                    }).map(([key, values]) =>
                      values?.map(value => (
                        <Tooltip key={value} title={getLabel(key)}>
                          <Tag color={TAG_CONFIG[key].color} style={{ margin: 0 }}>
                            {TAG_CONFIG[key].icon} {value}
                          </Tag>
                        </Tooltip>
                      ))
                    )}
                  </div>

                  <List
                    dataSource={dish.ingredients.slice(0, 3)}
                    style={{ flex: 1 }}
                    renderItem={ingredient => (
                      <List.Item>
                        <Text ellipsis style={{ fontSize: 12 }}>
                          {ingredient.name} - {ingredient.quantity} {ingredient.unit}
                        </Text>
                      </List.Item>
                    )}
                  />
                  {dish.ingredients.length > 3 && (
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
                      + еще {dish.ingredients.length - 3} {dish.ingredients.length - 3 === 1 ? 'ингредиент' : dish.ingredients.length - 3 >= 2 && dish.ingredients.length - 3 <= 4 ? 'ингредиента' : 'ингредиентов'}... 
                    </Text>
                  )}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={filteredDishes.length}
              onChange={(page, size) => {
                setCurrentPage(page);
                setPageSize(size);
              }}
              showSizeChanger
              pageSizeOptions={['6', '9', '18']}
              showTotal={(total, range) => `${range[0]}-${range[1]} из ${total}`}
              responsive
            />
          </div>
        </Col>
      </Row>

      {/* Модальные окна */}
      {selectedRecipe && (
        <DishModal
          dish={selectedRecipe}
          visible={isDishModalVisible}
          onClose={handleDishModalClose}
          isViewMode={true} // Включаем режим просмотра
        />
      )}

      <Modal
        title="Редактирование рецепта"
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <EditRecipeForm
          recipe={editingRecipe}
          onSave={(updatedRecipe) => {
            setDishes(prev => prev.map(d => d.name === updatedRecipe.name ? updatedRecipe : d));
            setIsEditModalVisible(false);
          }}
          onCancel={() => setIsEditModalVisible(false)}
          allIngredients={allIngredients}
          mealTypes={filterOptions.types}
          categories={filterOptions.categories}
          preferences={filterOptions.preferences}
          cuisines={filterOptions.cuisines}
        />
      </Modal>

      <Modal
        title="Удаление рецепта"
        open={isDeleteModalVisible}
        onOk={handleConfirmDelete}
        onCancel={() => setIsDeleteModalVisible(false)}
        okText="Удалить"
        cancelText="Отмена"
        okButtonProps={{
          danger: true,
          loading: deleteLoading
        }}
      >
        <p>Вы уверены, что хотите удалить рецепт "{recipeToDelete?.name}"?</p>
      </Modal>
    </div>
  );
};

const getLabel = (key) => {
  const labels = {
    type: 'Прием пищи',
    category: 'Категория',
    preference: 'Предпочтения',
    cuisine: 'Кухня'
  };
  return labels[key] || key;
};

export default RecipesList;