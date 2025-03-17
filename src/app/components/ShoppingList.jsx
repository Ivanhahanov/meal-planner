"use client"
import React, { useEffect, useState, useCallback } from 'react';
import { List, Button, Card, Tag, Divider, Flex, Collapse } from 'antd';
import { CopyOutlined, CheckOutlined, ShoppingCartOutlined, EyeOutlined } from '@ant-design/icons';

const unitConversions = {
  'г': { type: 'weight', baseUnit: 'кг', factor: 0.001 },
  'кг': { type: 'weight', baseUnit: 'кг', factor: 1 },
  'мл': { type: 'volume', baseUnit: 'л', factor: 0.001 },
  'л': { type: 'volume', baseUnit: 'л', factor: 1 },
  'шт': { type: 'count', baseUnit: 'шт', factor: 1 },
};

const ShoppingList = ({ menu, daysOfWeek=[] }) => {
  const [shoppingList, setShoppingList] = useState([]);
  const [checkedItems, setCheckedItems] = useState({});
  const [isCopied, setIsCopied] = useState(false);
  const [selectedDays, setSelectedDays] = useState(daysOfWeek.slice(0,3));
  const [expandedIngredients, setExpandedIngredients] = useState([]);

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

    return { unit: 'шт', quantity: baseQuantity };
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
        dishes: Array.from(item.dishes)
      };
    });
  }, [menu, getDisplayUnitAndQuantity]);

  const toggleExpanded = (name) => {
    setExpandedIngredients(prev =>
      prev.includes(name)
        ? prev.filter(n => n !== name)
        : [...prev, name]
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
      .map(ingredient => `${ingredient.name} - ${ingredient.quantity} ${ingredient.unit}`)
      .join('\n');

    navigator.clipboard.writeText(listString).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  useEffect(() => {
    setShoppingList(selectedDays.length > 0 ? generateShoppingList(selectedDays) : []);
  }, [selectedDays, generateShoppingList]);

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
          <ShoppingCartOutlined /> Список покупок
        </h3>
        <Button
          icon={isCopied ? <CheckOutlined /> : <CopyOutlined />}
          onClick={copyToClipboard}
          disabled={shoppingList.length === 0}
        // size="small"
        >
        </Button>
      </Flex>

      <Divider style={{ margin: '12px 0' }} />

      <Flex wrap="wrap" gap={4} style={{ marginBottom: 12 }}>
        {daysOfWeek.map(day => (
          <Button
            key={day}
            type={selectedDays.includes(day) ? 'primary' : 'default'}
            onClick={() => handleDaySelection(day)}
            // size="small"
            style={{ borderRadius: 5 }}
          >
            {day}
          </Button>
        ))}
      </Flex>

      <List
        dataSource={shoppingList}
        renderItem={(ingredient) => (
          <div style={{
            borderBottom: '1px solid #f0f0f0',
            padding: '8px 0',
          }}>
            <Flex align="center" gap={8} style={{ width: '100%' }}>
              {/* Checkbox */}
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
                  flexShrink: 0,
                }}
                onClick={() => handleCheck(ingredient.name, !checkedItems[ingredient.name])}
              >
                {checkedItems[ingredient.name] && (
                  <CheckOutlined style={{ color: '#999', fontSize: 12, }} />
                )}
              </div>

              <Flex align="center" style={{ flex: 1, minWidth: 0, gap: 8 }}>
                <div style={{
                  flex: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  <span style={{
                    textDecoration: checkedItems[ingredient.name] ? 'line-through' : 'none',
                    color: checkedItems[ingredient.name] ? '#999' : '#333',
                    fontSize: 15,
                  }}>
                    {ingredient.name}
                  </span>
                  <span style={{
                    fontSize: 14,
                    color: '#666',
                    marginLeft: 8
                  }}>
                    ({ingredient.quantity} {ingredient.unit})
                  </span>
                </div>

                {/* Иконка глаза */}
                {ingredient.dishes.length > 0 && (
                  <Button
                    type="text"
                    icon={<EyeOutlined />}
                    onClick={() => toggleExpanded(ingredient.name)}
                    size="small"
                    style={{
                      color: '#666',
                      padding: 0,
                      height: 'auto',
                      backgroundColor: 'transparent !important',
                    }}
                  />
                )}
              </Flex>
            </Flex>

            {/* Раскрывающийся список блюд */}
            {expandedIngredients.includes(ingredient.name) && (
              <div style={{
                marginTop: 8,
                paddingLeft: 28,
                fontSize: 14,
                color: '#666'
              }}>
                {ingredient.dishes.map((dish, index) => (
                  <div key={index}>• {dish}</div>
                ))}
              </div>
            )}
          </div>
        )}
      />
    </Card>
  );
};

export default ShoppingList;