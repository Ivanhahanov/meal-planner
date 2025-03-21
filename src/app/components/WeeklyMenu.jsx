"use client"
import '@ant-design/v5-patch-for-react-19';
import React, { useState, useEffect, useCallback } from 'react';
import { Button, Card, Typography, Segmented, Space, Select, Modal, Input, Grid, message } from 'antd';
import { useAuth } from '../context/AuthContext'
import { PlusOutlined, ShoppingCartOutlined, BookOutlined, ScheduleOutlined, SaveOutlined, RobotOutlined } from '@ant-design/icons';
import ShoppingList from './ShoppingList';
import AddDishModal from './AddDishModal';
import NewDishModal from './NewDishModal';
import RecipesList from './RecipesList';
import MenuList from './MenuList'
import GenerateMenuModal from './GenerateMenuModal';

const { Title } = Typography;
const { useBreakpoint } = Grid;
const daysOfWeek = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];


const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
const RANGE = process.env.NEXT_PUBLIC_GOOGLE_SHEET_RANGE || 'Recipes!A1:J';
const MENU_RANGE = process.env.NEXT_PUBLIC_GOOGLE_SHEET_MENU_RANGE || 'Menu!A1:D';


const WeeklyMenu = () => {
  const screens = useBreakpoint();
  const [menu, setMenu] = useState(() =>
    daysOfWeek.reduce((acc, day) => {
      acc[day] = [];
      return acc;
    }, {})
  );

  const [isNewDishModalVisible, setIsNewDishModalVisible] = useState(false);
  const [isAddDishModalVisible, setIsAddDishModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState('');
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allIngredients, setAllIngredients] = useState([]);
  const [mealTypes, setMealTypes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [preferences, setPreferences] = useState([]);
  const [cuisines, setCuisines] = useState([]);
  const [activeSection, setActiveSection] = useState('menu');
  const [savedMenus, setSavedMenus] = useState([]);
  const [isSaveMenuVisible, setIsSaveMenuVisible] = useState(false);
  const [newMenuName, setNewMenuName] = useState('');
  const [currentMenuName, setCurrentMenuName] = useState();
  const [menuEntries, setMenuEntries] = useState([]);
  const [isGenerateModalVisible, setIsGenerateModalVisible] = useState(false);


  const { token } = useAuth()

  useEffect(() => {
    const controller = new AbortController();

    const fetchAllData = async () => {
      try {
        setLoading(true);

        // 1. Загружаем рецепты и меню одним запросом
        const [recipesRes, menusRes] = await Promise.all([
          fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal
          }),
          fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${MENU_RANGE}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal
          })
        ]);

        // 2. Обрабатываем рецепты
        const recipesData = await recipesRes.json();
        const recipes = processRecipes(recipesData.values || []);
        setDishes(recipes);
        updateIngredients(recipes);

        // 3. Обрабатываем меню
        const menusData = await menusRes.json();
        const menuEntries = menusData.values || [];
        setMenuEntries(menuEntries);

        const savedMenuNames = [...new Set(menuEntries.map(row => row[0]))].filter(Boolean);

        // 4. Сразу обновляем состояние
        setSavedMenus(savedMenuNames);

        if (savedMenuNames.length > 0) {
          const firstMenu = savedMenuNames[0];
          const initialMenu = buildMenuFromData(menuEntries, recipes, firstMenu);
          setMenu(initialMenu);
          setCurrentMenuName(firstMenu);
        }
        setLoading(false);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Ошибка загрузки:', err);
          message.error('Ошибка загрузки данных');
        }
      }
    };

    if (token) fetchAllData();

    return () => controller.abort();
  }, [token]);


  const processRecipes = useCallback((values) => {
    return values?.reduce((acc, row) => {
      const [name, cookingTime, handsOnTime, type, category, preference, cuisine, ingName, ingQuantity, ingUnit] = row;
      let recipe = acc.find(r => r.name === name);

      if (!recipe) {
        recipe = {
          name,
          cookingTime: Number(cookingTime),
          handsOnTime: Number(handsOnTime),
          type: type?.split(',') || [],
          category: category?.split(',') || [],
          preference: preference?.split(',') || [],
          cuisine: cuisine?.split(',') || [],
          ingredients: []
        };
        acc.push(recipe);
      }

      recipe.ingredients.push({
        name: ingName,
        quantity: Number(ingQuantity),
        unit: ingUnit
      });

      return acc;
    }, []) || [];
  }, []);

  const buildMenuFromData = (menuEntries, recipes, menuName) => {
    return menuEntries
      .filter(row => row[0] === menuName)
      .reduce((acc, row) => {
        const [_, day, dishName, servings] = row;
        const dish = recipes.find(d => d.name?.trim() === dishName?.trim());

        if (dish) {
          acc[day] = acc[day] || [];
          acc[day].push({
            dish,
            servings: parseInt(servings) || 1
          });
        }
        return acc;
      }, daysOfWeek.reduce((acc, day) => ({ ...acc, [day]: [] }), {}));
  };

  // Обновим функцию сохранения меню
  const saveMenuToSheets = async (menuName) => {
    try {
      // Получаем текущие данные меню
      const getResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${MENU_RANGE}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      const existingData = await getResponse.json();
      const existingValues = existingData.values || [];

      // Фильтруем старые записи текущего меню
      const filteredValues = existingValues.filter(row => row[0] !== menuName);

      // Создаем новые записи
      const newValues = Object.entries(menu)
        .flatMap(([day, dishes]) =>
          dishes.map(({ dish, servings }) => [
            menuName,
            day,
            dish.name,
            String(servings)
          ])
        );

      // Объединяем данные
      const allValues = [...filteredValues, ...newValues];

      // Отправляем обновленные данные
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${MENU_RANGE}?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: allValues })
        }
      );

      // Обновляем список меню
      setSavedMenus(prev => [...new Set([...prev, menuName])]);
      setCurrentMenuName(menuName);
      message.success('Меню сохранено!');
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      message.error('Ошибка сохранения меню');
    }
  };

  useEffect(() => {
    if (savedMenus.length > 0 && !currentMenuName) {
      setCurrentMenuName(savedMenus[0]);
    }
  }, [savedMenus, currentMenuName]);

  const updateIngredients = (dishes) => {
    const ingredientsSet = new Set();
    const mealTypesSet = new Set();
    const categoriesSet = new Set();
    const preferencesSet = new Set();
    const cuisinesSet = new Set();
    dishes.forEach((dish) => {
      dish.ingredients.forEach((ingredient) => {
        ingredientsSet.add(ingredient.name);
      });
      dish.type.forEach((val) => {
        mealTypesSet.add(val);
      });
      dish.category.forEach((val) => {
        categoriesSet.add(val);
      });
      dish.preference.forEach((val) => {
        preferencesSet.add(val);
      });
      dish.cuisine.forEach((val) => {
        cuisinesSet.add(val);
      });
    });
    setAllIngredients(Array.from(ingredientsSet));
    setMealTypes(Array.from(mealTypesSet));
    setCategories(Array.from(categoriesSet));
    setPreferences(Array.from(preferencesSet));
    setCuisines(Array.from(cuisinesSet));
  };


  const addDishToDay = (day, dish) => {
    setMenu((prevMenu) => {
      const dayDishes = prevMenu[day];
      const existingIndex = dayDishes.findIndex(d => d.dish.name === dish.name);

      if (existingIndex !== -1) {
        const updated = [...dayDishes];
        updated[existingIndex] = {
          ...updated[existingIndex],
          servings: updated[existingIndex].servings + 1
        };
        return { ...prevMenu, [day]: updated };
      }
      return { ...prevMenu, [day]: [...dayDishes, { dish, servings: 1 }] };
    });
  };

  const updateServings = (day, dishName, newCount) => {
    setMenu((prevMenu) => {
      const dayDishes = prevMenu[day];
      const updated = dayDishes.map(item => {
        if (item.dish.name === dishName) {
          return { ...item, servings: Math.max(1, newCount) };
        }
        return item;
      });
      return { ...prevMenu, [day]: updated };
    });
  };

  const removeDishFromDay = (day, dishName) => {
    setMenu((prevMenu) => ({
      ...prevMenu,
      [day]: prevMenu[day].filter(item => item.dish.name !== dishName)
    }));
  };

  const showDishModal = (day) => {
    setSelectedDay(day);
    setIsAddDishModalVisible(true);
  };

  const handleSelectDish = (dish) => {
    addDishToDay(selectedDay, dish);
    setIsAddDishModalVisible(false);
  };

  const handleAddDish = (newDish) => {
    setDishes([...dishes, newDish]);
    const newIngredients = newDish.ingredients.map((ingredient) => ingredient.name);
    setAllIngredients((prevIngredients) => {
      const updatedIngredients = new Set([...prevIngredients, ...newIngredients]);
      return Array.from(updatedIngredients);
    });
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#fff', minHeight: '100vh', minWidth: '100vw' }}>
      <Modal
        title="Сохранить меню"
        open={isSaveMenuVisible}
        onOk={() => {
          if (newMenuName.trim()) {
            saveMenuToSheets(newMenuName.trim());
            setIsSaveMenuVisible(false);
            setNewMenuName('');
          }
        }}
        onCancel={() => setIsSaveMenuVisible(false)}
      >
        <Input
          placeholder="Введите название меню"
          value={newMenuName}
          onChange={(e) => setNewMenuName(e.target.value)}
        />
      </Modal>

      {/* Дополняем панель управления */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'center',
        marginBottom: 24
      }}>
        <Space wrap>

          {/* Остальные кнопки */}
        </Space>
      </div>

      {/* Обновляем DishModal для фильтрации */}
      <AddDishModal
        visible={isAddDishModalVisible}
        onCancel={() => setIsAddDishModalVisible(false)}
        onSelectDish={handleSelectDish}
        dishes={dishes}
      />

      <NewDishModal
        visible={isNewDishModalVisible}
        onCancel={() => setIsNewDishModalVisible(false)}
        onAddDish={handleAddDish}
        allIngredients={allIngredients}
        mealTypes={mealTypes}
        categories={categories}
        preferences={preferences}
        cuisines={cuisines}
      />
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'center',
        marginBottom: 24
      }}>
        <Title level={2} style={{ marginRight: 'auto', marginBottom: 0, display: 'flex', alignItems: 'center' }}>
          <img
            src={`${process.env.NEXT_PUBLIC_BASE_PATH}/lunchbox.png`} // Путь относительно папки public
            alt="Lunchbox"
            style={{
              width: 32,
              height: 32,
              marginRight: 6,
            }}
          />
          Meal Planner
        </Title>
        <Space wrap>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsNewDishModalVisible(true)}
          >
            Новое блюдо
          </Button>
          <Button
            type="primary"
            icon={<ShoppingCartOutlined />}
            onClick={() => {
              setActiveSection('shopping');
            }}
          >
            Сгенерировать список
          </Button>
        </Space>
      </div>

      <Segmented
        options={[
          { label: 'Меню', value: 'menu', icon: <ScheduleOutlined /> },
          { label: 'Список покупок', value: 'shopping', icon: <ShoppingCartOutlined /> },
          { label: 'Рецепты', value: 'recipes', icon: <BookOutlined /> },
        ]}
        value={activeSection}
        onChange={setActiveSection}
        style={{ marginBottom: '24px' }}
      />

      {activeSection === 'menu' && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          marginBottom: 24
        }}>
          <div style={{ marginRight: 'auto', marginBottom: 0 }}>
            <Space wrap>
              <Button
                type="primary"
                icon={<RobotOutlined />}
                onClick={() => {
                  if (preferences.length > 0 && categories.length > 0 && cuisines.length > 0) {
                    setIsGenerateModalVisible(true);
                  } else {
                    message.info('Данные ещё загружаются...');
                  }
                }}
                disabled={preferences.length === 0 || categories.length === 0 || cuisines.length === 0}
              >
                Сгенерировать меню
              </Button>
              <Button
                icon={<SaveOutlined />}
                onClick={() => setIsSaveMenuVisible(true)}
              >
                Сохранить
              </Button>
            </Space>
          </div>

          <Select
            placeholder={savedMenus.length ? "Выберите меню" : "Нет сохраненных меню"}
            value={currentMenuName}
            options={savedMenus.map(name => ({ label: name, value: name }))}
            onChange={value => {
              const selectedMenu = buildMenuFromData(menuEntries, dishes, value);
              setMenu(selectedMenu);
              setCurrentMenuName(value);
            }}
            style={{ width: 250 }}
            loading={loading}
          />

          <GenerateMenuModal
            isGenerateModalVisible={isGenerateModalVisible}
            setIsGenerateModalVisible={setIsGenerateModalVisible}
            dishes={dishes}
            setMenu={setMenu}
            preferences={preferences}
            categories={categories}
            cuisines={cuisines}
          />

          {/* Карточки с днями недели */}
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {daysOfWeek.map((day, dayIndex) => (
              <Card
                key={day}
                loading={loading}
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      color: dayIndex > 4 ? '#ff4d4f' : '#1890ff',
                      fontWeight: 500,
                      fontSize: 17,
                    }}>
                      {day}
                    </span>
                    <Button
                      onClick={() => showDishModal(day)}
                      icon={<PlusOutlined />}
                      style={{ padding: '0 8px' }}
                    >
                      Добавить
                    </Button>
                  </div>
                }
                styles={{ body: { padding: "12px 10px" } }}
                style={{
                  width: screens.xs ? '100%' : 339,
                  margin: screens.xs ? '8px 0' : '16px 16px 0 0',
                }}
              >
                <MenuList day={day} menu={menu} updateServings={updateServings} removeDishFromDay={removeDishFromDay}></MenuList>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeSection === 'shopping' && (
        <ShoppingList menu={menu} daysOfWeek={daysOfWeek} />
      )}

      {activeSection === 'recipes' && (
        <RecipesList dishes={dishes} setDishes={setDishes} allIngredients={allIngredients} />
      )}
    </div>
  );
};

export default WeeklyMenu;