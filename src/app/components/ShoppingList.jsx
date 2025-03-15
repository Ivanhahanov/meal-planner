"use client"
import React, { useState } from 'react';
import { List, Checkbox, Button, message, Card } from 'antd';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';

const ShoppingList = ({ shoppingList }) => {
  const [checkedItems, setCheckedItems] = useState({});
  const [isCopied, setIsCopied] = useState(false);

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
      setIsCopied(true); 
      message.success('Список скопирован в буфер обмена!');
      setTimeout(() => setIsCopied(false), 2000);
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
          position: 'relative',
        }}
      >
        <Button
          icon={isCopied ? <CheckOutlined /> : <CopyOutlined />}
          onClick={copyToClipboard}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '40px',
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
              <Checkbox
                checked={checkedItems[ingredient.name] || false}
                onChange={(e) => handleCheck(ingredient.name, e.target.checked)}
                style={{
                  marginRight: '12px',
                  width: '20px',
                  height: '20px',
                }}
              />
              <span
                style={{
                  textDecoration: checkedItems[ingredient.name] ? 'line-through' : 'none',
                  color: checkedItems[ingredient.name] ? '#999' : '#000',
                  flex: 1,
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