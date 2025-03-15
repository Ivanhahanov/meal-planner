"use client"
import React, { useState, useEffect } from 'react';
import { Modal, Input, List, Button, Tag } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';

const DishModal = ({ visible, onCancel, onSelectDish, dishes }) => {
  const [searchText, setSearchText] = useState('');
  const [filteredDishes, setFilteredDishes] = useState(dishes);

  useEffect(() => {
    setFilteredDishes(dishes);
  }, [dishes]);

  const handleSearch = (value) => {
    setSearchText(value);
    const filtered = dishes.filter((dish) =>
      dish.name.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredDishes(filtered);
  };

  return (
    <Modal
      title="Выберите блюдо"
      open={visible}
      onCancel={onCancel}
      footer={null}
    >
      <Input
        placeholder="Поиск блюд"
        value={searchText}
        onChange={(e) => handleSearch(e.target.value)}
        style={{ marginBottom: '16px' }}
      />
      <List
        dataSource={filteredDishes.slice(0, 5)}
        renderItem={(dish) => (
          <List.Item>
            <Button
              type="text"
              onClick={() => onSelectDish(dish)}
              style={{
                width: '100%',
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{
                maxWidth: '70%',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {dish.name}
              </span>

              <div style={{ display: 'flex', gap: 8 }}>
                <Tag icon={<ClockCircleOutlined />} color="blue">
                  {dish.cookingTime} мин
                </Tag>
                <Tag icon={<ClockCircleOutlined />} color="green">
                  {dish.handsOnTime} мин
                </Tag>
              </div>
            </Button>
          </List.Item>
        )}
      />
    </Modal>
  );
};

export default DishModal;