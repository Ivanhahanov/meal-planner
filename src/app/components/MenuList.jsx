import React, { useState, useEffect } from 'react';
import { List, Button, Popconfirm } from 'antd';
import { MinusOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons';
import styles from './MenuList.module.css';
import DishModal from './DishModal';

const MenuList = ({ menu, updateServings, removeDishFromDay, day }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  useEffect(() => {
    if (selectedItem) {
      const updatedItem = menu[day].find(
        item => item.dish.name === selectedItem.dish.name
      );
      setSelectedItem(updatedItem || null);
    }
  }, [menu[day]]);
  return (
    <>
      <List
        dataSource={menu[day]}
        renderItem={(item) => (
          <div 
            className={styles.menuItem}
            onClick={() => setSelectedItem(item)}
            style={{ cursor: 'pointer' }}
          >
            <div className={styles.menuContent}>
              <div className={styles.dishName}>
                <span style={{ marginRight: 8, color: '#666', fontSize: 12 }}>
                  {item.servings}x
                </span>
                <span style={{ fontWeight: 500 }}>{item.dish.name}</span>
                <span style={{ marginLeft: 8, color: '#666', fontSize: 12 }}>
                  {item.dish.cookingTime}'
                </span>
              </div>
            </div>

            <div className={styles.menuActions}>
              <Button
                type="text"
                size="small"
                icon={<MinusOutlined style={{ fontSize: 12 }} />}
                onClick={(e) => {
                  e.stopPropagation();
                  updateServings(day, item.dish.name, item.servings - 1);
                }}
                disabled={item.servings === 1}
                style={{ width: 24, height: 24 }}
              />
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined style={{ fontSize: 12 }} />}
                onClick={(e) => {
                  e.stopPropagation();
                  updateServings(day, item.dish.name, item.servings + 1);
                }}
                style={{ width: 24, height: 24 }}
              />
              <Popconfirm
                title="Удалить блюдо?"
                onConfirm={() => removeDishFromDay(day, item.dish.name)}
                onCancel={(e) => e?.stopPropagation()}
              >
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<CloseOutlined style={{ fontSize: 12 }} />}
                  style={{ width: 24, height: 24 }}
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            </div>
          </div>
        )}
      />
      {selectedItem && (
      <DishModal
        dish={selectedItem?.dish}
        visible={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        // Добавляем пропсы для управления порциями и удалением
        servings={selectedItem?.servings}
        day={day}
        updateServings={updateServings}
        removeDishFromDay={removeDishFromDay}
      />
      )}
    </>
  );
};

export default MenuList;