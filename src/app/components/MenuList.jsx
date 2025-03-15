import React from 'react';
import { List, Button, Popconfirm } from 'antd';
import { MinusOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons';
import styles from './MenuList.module.css'; // Импорт стилей

const MenuList = ({ menu, updateServings, removeDishFromDay, day }) => {
  return (
    <List
      dataSource={menu[day]}
      renderItem={(item) => (
        <div className={styles.menuItem}>
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
            >
              <Button
                type="text"
                danger
                size="small"
                icon={<CloseOutlined style={{ fontSize: 12 }} />}
                style={{ width: 24, height: 24 }}
              />
            </Popconfirm>
          </div>
        </div>
      )}
    />
  );
};

export default MenuList;