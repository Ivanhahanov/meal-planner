"use client"
import React, { useEffect, useState, useCallback } from 'react';
import { List, Button, Card, Divider, Flex } from 'antd';
import { CopyOutlined, CheckOutlined, ShoppingCartOutlined, EyeOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import PerekrestokCart from './PerekrestokCart';

const unitConversions = {
  'г': { type: 'weight', baseUnit: 'кг', factor: 0.001 },
  'кг': { type: 'weight', baseUnit: 'кг', factor: 1 },
  'мл': { type: 'volume', baseUnit: 'л', factor: 0.001 },
  'л': { type: 'volume', baseUnit: 'л', factor: 1 },
  'шт': { type: 'count', baseUnit: 'шт', factor: 1 },
};

const ShoppingList = ({ menu, daysOfWeek = [] }) => {
  const [shoppingList, setShoppingList] = useState([]);
  const [checkedItems, setCheckedItems] = useState({});
  const [isCopied, setIsCopied] = useState(false);
  const [selectedDays, setSelectedDays] = useState(daysOfWeek.slice(0, 3));
  const [expandedIngredients, setExpandedIngredients] = useState([]);
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [editedQuantities, setEditedQuantities] = useState({});

  const getDisplayUnitAndQuantity = useCallback((baseQuantity, type) => {
    if (type === 'weight') {
      return baseQuantity >= 1
        ? { unit: 'кг', quantity: parseFloat(baseQuantity.toFixed(2)) }
        : { unit: 'г', quantity: parseFloat((baseQuantity * 1000).toFixed(2)) };
    }
    if (type === 'volume') {
      return baseQuantity >= 1
        ? { unit: 'л', quantity: parseFloat(baseQuantity.toFixed(2)) }
        : { unit: 'мл', quantity: parseFloat((baseQuantity * 1000).toFixed(2)) };
    }
    return { unit: 'шт', quantity: Math.round(baseQuantity) };
  }, []);

  const generateShoppingList = useCallback((days) => {
    const allIngredients = days.flatMap(day =>
      menu[day].flatMap(({ dish, servings }) =>
        dish.ingredients.map(ing => ({
          ...ing,
          quantity: ing.quantity * servings,
          dishName: dish.name
        })))
    );

    const groupedIngredients = allIngredients.reduce((acc, ingredient) => {
      const { name, quantity, unit = 'шт', dishName } = ingredient;
      const conversion = unitConversions[unit] || unitConversions['шт'];
      const key = `${name}_${conversion.type}`;

      if (!acc[key]) {
        acc[key] = {
          name,
          type: conversion.type,
          total: 0,
          baseUnit: conversion.baseUnit,
          dishes: new Set()
        };
      }

      acc[key].total += quantity * conversion.factor;
      acc[key].dishes.add(dishName);
      return acc;
    }, {});

    return Object.values(groupedIngredients).map(item => {
      const { unit, quantity } = getDisplayUnitAndQuantity(item.total, item.type);
      return {
        name: item.name,
        quantity,
        unit,
        baseTotal: item.total,
        type: item.type,
        dishes: Array.from(item.dishes)
      };
    });
  }, [menu, getDisplayUnitAndQuantity]);

  useEffect(() => {
    setShoppingList(selectedDays.length > 0 ? generateShoppingList(selectedDays) : []);
    setEditedQuantities({});
  }, [selectedDays, generateShoppingList]);

  const handleAdjustQuantity = (ingredient, delta) => {
    const key = `${ingredient.name}_${ingredient.type}`;
    const currentBaseTotal = editedQuantities[key]?.baseTotal ?? ingredient.baseTotal;
    const newBaseTotal = Math.max(currentBaseTotal + delta, 0);

    setEditedQuantities(prev => ({
      ...prev,
      [key]: { baseTotal: newBaseTotal },
    }));
  };

  const handleIncrease = (ingredient) => {
    const delta = ingredient.type === 'count' ? 1 : 0.1;
    handleAdjustQuantity(ingredient, delta);
  };

  const handleDecrease = (ingredient) => {
    const delta = ingredient.type === 'count' ? -1 : -0.1;
    handleAdjustQuantity(ingredient, delta);
  };

  useEffect(() => {
    setShoppingList(selectedDays.length > 0 ? generateShoppingList(selectedDays) : []);
  }, [selectedDays, generateShoppingList]);

  const toggleExpanded = (name) => {
    setExpandedIngredients(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const handleCheck = (ingredientName, checked) => {
    setCheckedItems(prev => ({ ...prev, [ingredientName]: checked }));
  };

  const handleDaySelection = (day) => {
    setSelectedDays(prev => prev.includes(day)
      ? prev.filter(d => d !== day)
      : [...prev, day]
    );
  };

  const copyToClipboard = () => {
    const listString = shoppingList
      .filter(ingredient => !checkedItems[ingredient.name])
      .map(ingredient => `${ingredient.name} - ${ingredient.quantity} ${ingredient.unit}`)
      .join('\n');
    navigator.clipboard.writeText(listString).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const getCartIngredients = () => {
    return shoppingList
      .filter(ingredient => !checkedItems[ingredient.name])
      .map(ingredient => {
        const key = `${ingredient.name}_${ingredient.type}`;
        const baseTotal = editedQuantities[key]?.baseTotal ?? ingredient.baseTotal;
        const { quantity, unit } = getDisplayUnitAndQuantity(baseTotal, ingredient.type);
        return { ...ingredient, quantity, unit };
      });
  };

  return (
    <Card
      style={{
        width: '100%',
        maxWidth: 600,
        margin: '16px auto',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
      styles={{
        body: { padding: 16 }
      }}
    >
      <Flex justify="space-between" align="center" gap={8}>
        <h3 style={{ margin: 0, fontSize: 18 }}>
          {isCartVisible ? (
            <><ShoppingCartOutlined /> Корзина Перекресток</>
          ) : (
            <><ShoppingCartOutlined /> Список покупок</>
          )}
        </h3>
        <Flex gap={8}>
          {!isCartVisible && (
            <Button
              icon={isCopied ? <CheckOutlined /> : <CopyOutlined />}
              onClick={copyToClipboard}
              disabled={shoppingList.length === 0}
            />
          )}
          <Button
            icon={isCartVisible ? <ArrowLeftOutlined /> : <ShoppingCartOutlined />}
            onClick={() => setIsCartVisible(!isCartVisible)}
            disabled={!isCartVisible && shoppingList.length === 0}
          />
        </Flex>
      </Flex>

      {isCartVisible ? (
        <PerekrestokCart ingredients={getCartIngredients()} />
      ) : (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <Flex wrap="wrap" gap={4} style={{ marginBottom: 12 }}>
            {daysOfWeek.map(day => (
              <Button
                key={day}
                type={selectedDays.includes(day) ? 'primary' : 'default'}
                onClick={() => handleDaySelection(day)}
                style={{ borderRadius: 5 }}
              >
                {day}
              </Button>
            ))}
          </Flex>
          <List
            dataSource={shoppingList}
            renderItem={(ingredient) => {
              const key = `${ingredient.name}_${ingredient.type}`;
              const currentBaseTotal = editedQuantities[key]?.baseTotal ?? ingredient.baseTotal;
              const originalDisplay = getDisplayUnitAndQuantity(ingredient.baseTotal, ingredient.type);
              const currentDisplay = getDisplayUnitAndQuantity(currentBaseTotal, ingredient.type);

              return (
                <div style={{ borderBottom: '1px solid #f0f0f0', padding: '8px 0' }}>
                  <Flex align="center" gap={8} style={{ width: '100%' }}>
                    {/* Чекбокс */}
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        border: '2px solid #d9d9d9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        backgroundColor: checkedItems[ingredient.name] ? '#eee' : '#fff',
                      }}
                      onClick={() => handleCheck(ingredient.name, !checkedItems[ingredient.name])}
                    >
                      {checkedItems[ingredient.name] && <CheckOutlined style={{ color: '#999', fontSize: 12 }} />}
                    </div>

                    <Flex align="center" style={{ flex: 1, minWidth: 0, gap: 8 }}>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <span style={{
                          textDecoration: checkedItems[ingredient.name] ? 'line-through' : 'none',
                          color: checkedItems[ingredient.name] ? '#999' : '#333',
                        }}>
                          {ingredient.name}
                        </span>
                        <span style={{ color: '#666', marginLeft: 8 }}>
                          {Math.abs(currentBaseTotal - ingredient.baseTotal) > 0 ? (
                            <>
                              <span style={{ textDecoration: 'line-through', color: '#999' }}>
                                {originalDisplay.quantity} {originalDisplay.unit}
                              </span>
                              {' → '}
                              <span style={{ color: '#1890ff', fontWeight: 500 }}>
                                {currentDisplay.quantity} {currentDisplay.unit}
                              </span>
                            </>
                          ) : (
                            <span>
                              {currentDisplay.quantity} {currentDisplay.unit}
                            </span>
                          )}
                        </span>
                      </div>

                      <Flex gap={4} align="center">
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDecrease(ingredient);
                          }}
                          disabled={checkedItems[ingredient.name]}
                          style={{ minWidth: 24, height: 24, padding: 0 }}
                        >
                          -
                        </Button>
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleIncrease(ingredient);
                          }}
                          disabled={checkedItems[ingredient.name]}
                          style={{ minWidth: 24, height: 24, padding: 0 }}
                        >
                          +
                        </Button>
                      </Flex>

                      {ingredient.dishes.length > 0 && (
                        <Button
                          type="text"
                          icon={<EyeOutlined />}
                          onClick={() => toggleExpanded(ingredient.name)}
                          size="small"
                          style={{ padding: 0 }}
                        />
                      )}
                    </Flex>
                  </Flex>

                  {expandedIngredients.includes(ingredient.name) && (
                    <div style={{ marginTop: 8, paddingLeft: 28, color: '#666' }}>
                      {ingredient.dishes.map((dish, index) => (
                        <div key={index}>• {dish}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }}
          />
        </>
      )}
    </Card>
  );
};

export default ShoppingList;