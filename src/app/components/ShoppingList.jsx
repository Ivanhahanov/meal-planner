"use client"
import React, { useState } from 'react';
import { List, Checkbox, Button, message, Card } from 'antd';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';

const ShoppingList = ({ shoppingList }) => {
  const [checkedItems, setCheckedItems] = useState({});
  const [isCopied, setIsCopied] = useState(false); // Состояние для индикатора копирования

  const handleCheck = (ingredientName, checked) => {
    setCheckedItems((prev) => ({
      ...prev,
      [ingredientName]: checked,
    }));
  };

  const copyToClipboard = () => {
    const listString = shoppingList
      .map((ingredient) => `${ingredient.name} - ${ingredient.quantity} ${ingredient.unit}`)
      .join('\n');
    navigator.clipboard.writeText(listString).then(() => {
      setIsCopied(true); // Устанавливаем индикатор копирования
      message.success('Список скопирован в буфер обмена!');
      setTimeout(() => setIsCopied(false), 2000); // Сбрасываем индикатор через 2 секунды
    });
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <Card
        style={{
          width: '100%',
          maxWidth: '600px',
          padding: '24px',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e8e8e8',
          borderRadius: '8px',
          backgroundColor: '#fafafa',
          position: 'relative', // Для позиционирования кнопки
        }}
      >
        {/* Кнопка "Скопировать" сверху справа */}
        <Button
          icon={isCopied ? <CheckOutlined /> : <CopyOutlined />} // Меняем иконку на галочку, если скопировано
          onClick={copyToClipboard}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '40px', // Маленький размер
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />

        {/* Список покупок */}
        <List
          dataSource={shoppingList}
          renderItem={(ingredient) => (
            <List.Item
              style={{
                padding: '8px 0',
                borderBottom: '1px solid #e8e8e8',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {/* Круглый чекбокс */}
              <Checkbox
                checked={checkedItems[ingredient.name] || false}
                onChange={(e) => handleCheck(ingredient.name, e.target.checked)}
                style={{
                  marginRight: '12px',
                  width: '20px',
                  height: '20px',
                }}
              />
              {/* Текст рядом с чекбоксом */}
              <span
                style={{
                  textDecoration: checkedItems[ingredient.name] ? 'line-through' : 'none',
                  color: checkedItems[ingredient.name] ? '#999' : '#000',
                  flex: 1, // Чтобы текст занимал оставшееся пространство
                }}
              >
                {ingredient.name} - {ingredient.quantity} {ingredient.unit}
              </span>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};

export default ShoppingList;