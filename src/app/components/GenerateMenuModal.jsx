import React, { useState, useEffect } from 'react';
import {
    Modal, Form, Slider, Select, Switch, Tabs, Divider, Space,
    Tag, Button, Tooltip, Typography, Collapse, Checkbox, InputNumber, Input, Alert
} from 'antd';
import {
    SettingOutlined, AppstoreOutlined, GlobalOutlined,
    ExperimentOutlined, RobotOutlined, ClockCircleOutlined,
    CalendarOutlined, TeamOutlined, UserOutlined, CloseOutlined, UserAddOutlined, ProfileOutlined
} from '@ant-design/icons';
const { Text } = Typography;
const { Panel } = Collapse;

const daysOfWeek = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const shortenedDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const useMobileDetect = () => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.matchMedia('(max-width: 768px)').matches);

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return isMobile;
};

const GenerateMenuModal = ({
    isGenerateModalVisible,
    setIsGenerateModalVisible,
    dishes,
    setMenu,
    preferences,
    categories,
    cuisines
}) => {
    const isMobile = useMobileDetect();
    const [activeTab, setActiveTab] = useState('basic');
    const [daySettingsOpen, setDaySettingsOpen] = useState([]);
    const [errors, setErrors] = useState([]);

    const [mealStructure, setMealStructure] = useState({
        'Завтрак': ['Основное'],
        'Обед': ['Суп', 'Основное', 'Салат'],
        'Ужин': ['Основное']
    });

    const [generationSettings, setGenerationSettings] = useState({
        defaultPeopleCount: 1,
        defaultMealTypes: Object.keys(mealStructure),
        daysSettings: daysOfWeek.reduce((acc, day) => ({
            ...acc,
            [day]: {
                users: [
                    {
                        id: 1,
                        name: 'Пользователь 1',
                        selectedMeals: Object.keys(mealStructure),
                    }
                ]
            }
        }), {}),
        preferences: preferences,
        maxCookingTime: 120,
        cuisines: cuisines,
        categories: categories,
        mealPrep: {
            enabled: false,
            maxReuse: 2,
            storageDays: 2
        }
    });

    const allMealTypes = Object.keys(mealStructure)


    const handleUserChange = (day, userId, field, value) => {
        setGenerationSettings(prev => {
            const newUsers = prev.daysSettings[day].users.map(user =>
                user.id === userId ? { ...user, [field]: value } : user
            );

            return {
                ...prev,
                daysSettings: {
                    ...prev.daysSettings,
                    [day]: {
                        ...prev.daysSettings[day],
                        users: newUsers
                    }
                }
            };
        });
    };

    const addNewUser = (day) => {
        setGenerationSettings(prev => {
            const daySettings = prev.daysSettings[day];
            const newUserId = Math.max(...daySettings.users.map(u => u.id)) + 1;

            return {
                ...prev,
                daysSettings: {
                    ...prev.daysSettings,
                    [day]: {
                        ...daySettings,
                        users: [
                            ...daySettings.users,
                            {
                                id: newUserId,
                                name: `Пользователь ${newUserId}`,
                                selectedMeals: [...prev.defaultMealTypes],
                            }
                        ]
                    }
                }
            };
        });
    };

    const removeUser = (day, userId) => {
        setGenerationSettings(prev => ({
            ...prev,
            daysSettings: {
                ...prev.daysSettings,
                [day]: {
                    ...prev.daysSettings[day],
                    users: prev.daysSettings[day].users.filter(u => u.id !== userId)
                }
            }
        }));
    };

    const renderUserSettings = (day) => {
        return generationSettings.daysSettings[day].users.map((user, index) => (
            <div key={user.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Button
                        danger
                        type="text"
                        icon={<CloseOutlined />}
                        onClick={() => removeUser(day, user.id)}
                        disabled={generationSettings.daysSettings[day].users.length === 1}
                    />
                    <Form.Item
                        label="Имя"
                        style={{ flex: 1 }}
                        rules={[{ required: true, message: 'Введите имя' }]}
                    >
                        <Input
                            value={user.name}
                            onChange={e => handleUserChange(day, user.id, 'name', e.target.value)}
                            prefix={<UserOutlined />}
                            placeholder="Имя пользователя"
                        />
                    </Form.Item>
                </div>

                <Form.Item label="Приёмы пищи">
                    <Select
                        mode="multiple"
                        style={{ width: '100%' }}
                        placeholder="Выберите приёмы пищи"
                        value={user.selectedMeals}
                        onChange={values => handleUserChange(day, user.id, 'selectedMeals', values)}
                    >
                        {allMealTypes.map(meal => (
                            <Option key={meal} value={meal}>{meal}</Option>
                        ))}
                    </Select>
                </Form.Item>

                {index < generationSettings.daysSettings[day].users.length - 1 && <Divider />}
            </div>
        ));
    };

    const generateWeeklyMenu = (settings) => {
        const generatedMenu = {};
        const dishUsageMap = new Map(); // { dishName: day[] }
        const dailyUsedDishes = new Map();
        const errors = [];

        // Получаем индекс дня в неделе для проверки временного интервала
        const getDayIndex = (day) => daysOfWeek.indexOf(day);

        daysOfWeek.forEach(day => {
            generatedMenu[day] = [];
            dailyUsedDishes.set(day, new Set());

            const dailySettings = settings.daysSettings[day];
            const mealTypes = new Set();

            // Собираем уникальные типы приёмов пищи для дня
            dailySettings.users.forEach(user => {
                user.selectedMeals.forEach(mealType => {
                    mealTypes.add(mealType);
                });
            });

            Array.from(mealTypes).forEach(mealType => {
                const requiredComponents = mealStructure[mealType] || [];
                const participatingUsers = dailySettings.users.filter(user =>
                    user.selectedMeals.includes(mealType)
                );

                if (participatingUsers.length === 0) return;

                const totalServings = participatingUsers.length;
                const componentDishes = {};

                requiredComponents.forEach(component => {
                    // Фильтрация с учётом всех ограничений
                    let filteredDishes = dishes.filter(dish => {
                        const matchesComponent = dish.category.includes(component);
                        const matchesType = dish.type.includes(mealType);
                        const matchesPreferences = settings.preferences.length === 0 ||
                            dish.preference.some(p => settings.preferences.includes(p));
                        const matchesCuisine = settings.cuisines.length === 0 ||
                            dish.cuisine.some(c => settings.cuisines.includes(c));
                        const matchesTime = dish.cookingTime <= settings.maxCookingTime;

                        // Проверка на повторное использование для meal prep
                        if (settings.mealPrep.enabled) {
                            const usages = dishUsageMap.get(dish.name) || [];
                            const currentDayIndex = getDayIndex(day);
                            const startIndex = currentDayIndex - (settings.mealPrep.storageDays - 1);

                            // Считаем использование в заданном временном окне
                            const relevantUsages = usages.filter(usageDay => {
                                const usageIndex = getDayIndex(usageDay);
                                return usageIndex >= Math.max(startIndex, 0) &&
                                    usageIndex <= currentDayIndex;
                            });

                            if (relevantUsages.length >= settings.mealPrep.maxReuse) {
                                return false;
                            }
                        }

                        return matchesComponent && matchesType && matchesPreferences &&
                            matchesCuisine && matchesTime;
                    });

                    // Проверка на доступные блюда
                    if (filteredDishes.length === 0) {
                        errors.push({
                            day,
                            mealType,
                            component,
                            users: participatingUsers.map(u => u.name)
                        });
                        return;
                    }

                    // Сортируем блюда по частоте использования для разнообразия
                    filteredDishes.sort((a, b) => {
                        const aCount = (dishUsageMap.get(a.name) || []).length;
                        const bCount = (dishUsageMap.get(b.name) || []).length;
                        return aCount - bCount;
                    });

                    // Выбираем из 3 наименее используемых для случайности
                    const topCandidates = filteredDishes.slice(0, 3);
                    const selectedDish = topCandidates[
                        Math.floor(Math.random() * topCandidates.length)
                    ];

                    componentDishes[component] = selectedDish;
                });

                if (Object.keys(componentDishes).length !== requiredComponents.length) return;

                // Обновляем статистику использования
                Object.values(componentDishes).forEach(selectedDish => {
                    // Обновляем глобальное использование
                    const usages = dishUsageMap.get(selectedDish.name) || [];
                    dishUsageMap.set(selectedDish.name, [...usages, day]);

                    // Добавляем блюдо в день
                    const existingEntry = generatedMenu[day].find(
                        entry => entry.dish.name === selectedDish.name
                    );

                    if (existingEntry) {
                        existingEntry.servings += totalServings;
                    } else {
                        generatedMenu[day].push({
                            dish: selectedDish,
                            servings: totalServings
                        });
                    }

                    dailyUsedDishes.get(day).add(selectedDish.name);
                });
            });
        });

        if (errors.length > 0) {
            setErrors(errors);
            return false;
        }

        setErrors([]);
        setMenu(generatedMenu);
        return true;
    };

    useEffect(() => {
        // Автоматическое обновление количества пользователей для всех дней
        const newDaysSettings = { ...generationSettings.daysSettings };

        daysOfWeek.forEach(day => {
            const currentUsers = newDaysSettings[day].users;
            const targetCount = generationSettings.defaultPeopleCount;

            // Сохраняем существующих пользователей
            const updatedUsers = currentUsers.slice(0, targetCount);

            // Добавляем новых пользователей при необходимости
            while (updatedUsers.length < targetCount) {
                const newUserId = updatedUsers.length + 1;
                updatedUsers.push({
                    id: newUserId,
                    name: `Пользователь ${newUserId}`,
                    selectedMeals: [...generationSettings.defaultMealTypes],
                });
            }

            newDaysSettings[day] = {
                ...newDaysSettings[day],
                users: updatedUsers
            };
        });

        setGenerationSettings(prev => ({
            ...prev,
            daysSettings: newDaysSettings
        }));
    }, [generationSettings.defaultPeopleCount]);

    useEffect(() => {
        // Обновляем выбранные приёмы пищи для всех пользователей
        const newDaysSettings = { ...generationSettings.daysSettings };

        daysOfWeek.forEach(day => {
            newDaysSettings[day].users = newDaysSettings[day].users.map(user => ({
                ...user,
                selectedMeals: generationSettings.defaultMealTypes
            }));
        });

        setGenerationSettings(prev => ({
            ...prev,
            daysSettings: newDaysSettings
        }));
    }, [generationSettings.defaultMealTypes]);


    const sections = [
        {
            key: 'basic',
            label: <span><SettingOutlined /> Основные</span>,
            children: (
                <>
                    <Form.Item label="Количество людей">
                        <InputNumber
                            min={1}
                            value={generationSettings.defaultPeopleCount}
                            onChange={value => setGenerationSettings(prev => ({
                                ...prev,
                                defaultPeopleCount: value
                            }))}
                        />
                    </Form.Item>

                    <Form.Item label="Макс. время готовки">
                        <Slider
                            min={10}
                            max={180}
                            step={10}
                            value={generationSettings.maxCookingTime}
                            onChange={value => setGenerationSettings(prev => ({
                                ...prev,
                                maxCookingTime: value
                            }))}
                            marks={{ 10: '10', 60: '1ч', 120: '2ч', 180: '3ч' }}
                        />
                    </Form.Item>

                    <Form.Item label="Планирование готовки">
                        <Switch
                            checked={generationSettings.mealPrep.enabled}
                            onChange={checked => setGenerationSettings(prev => ({
                                ...prev,
                                mealPrep: { ...prev.mealPrep, enabled: checked }
                            }))}
                        />
                    </Form.Item>

                    {generationSettings.mealPrep.enabled && (
                        <div style={{ marginLeft: 24 }}>
                            <Form.Item label="Макс. повторений блюда">
                                <Slider
                                    min={1}
                                    max={5}
                                    value={generationSettings.mealPrep.maxReuse}
                                    onChange={value => setGenerationSettings(prev => ({
                                        ...prev,
                                        mealPrep: { ...prev.mealPrep, maxReuse: value }
                                    }))}
                                />
                            </Form.Item>

                            <Form.Item label="Срок хранения (дней)">
                                <Slider
                                    min={1}
                                    max={7}
                                    value={generationSettings.mealPrep.storageDays}
                                    onChange={value => setGenerationSettings(prev => ({
                                        ...prev,
                                        mealPrep: { ...prev.mealPrep, storageDays: value }
                                    }))}
                                />
                            </Form.Item>
                        </div>
                    )}
                </>
            )
        },
        {
            key: 'preferences',
            label: <span><AppstoreOutlined /> Предпочтения</span>,
            children: (
                <>
                    <Form.Item label="Предпочтения">
                        <Select
                            mode="multiple"
                            value={generationSettings.preferences}
                            onChange={value => setGenerationSettings(prev => ({
                                ...prev,
                                preferences: value
                            }))}
                            options={preferences.map(p => ({ label: p, value: p }))}
                        />
                    </Form.Item>

                    <Form.Item label="Кухни мира">
                        <Select
                            mode="multiple"
                            value={generationSettings.cuisines}
                            onChange={value => setGenerationSettings(prev => ({
                                ...prev,
                                cuisines: value
                            }))}
                            options={cuisines.map(c => ({ label: c, value: c }))}
                        />
                    </Form.Item>
                </>
            )
        },
        {
            key: 'structure',
            label: <span><ProfileOutlined /> Структура меню</span>,
            children: (
                <div>
                    {Object.keys(mealStructure).map(mealType => (
                        <div key={mealType} style={{ marginBottom: 16 }}>
                            <Divider orientation="left">{mealType}</Divider>
                            <Select
                                mode="multiple"
                                value={mealStructure[mealType]}
                                onChange={values => setMealStructure(prev => ({
                                    ...prev,
                                    [mealType]: values
                                }))}
                                options={categories.map(c => ({ label: c, value: c }))}
                            />
                        </div>
                    ))}
                </div>
            )
        },
        {
            key: 'schedule',
            label: <span><CalendarOutlined /> Расписание</span>,
            children: (
                <Collapse
                    activeKey={daySettingsOpen}
                    onChange={setDaySettingsOpen}
                    ghost
                    collapsible="icon"
                >
                    {daysOfWeek.map((day, index) => (
                        <Panel
                            key={day}
                            header={
                                <Space align="center">
                                    <Text strong>{daysOfWeek[index]}</Text>
                                    <Text type="secondary">{generationSettings.daysSettings[day].users.length} чел.</Text>
                                </Space>
                            }
                            extra={
                                <Button
                                    size="small"
                                    type="text"
                                    icon={<UserAddOutlined />}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        addNewUser(day);
                                    }}
                                />
                            }
                        >
                            <div style={{ marginLeft: isMobile ? 0 : 24 }}>
                                {renderUserSettings(day)}
                            </div>
                        </Panel>
                    ))}
                </Collapse>
            )
        }
    ];

    return (
        <Modal
            title={
                <Space>
                    <Tooltip title="Генератор меню">
                        <Button shape="circle" icon={<RobotOutlined />} />
                    </Tooltip>
                    <span>Настройки генерации</span>
                </Space>
            }
            open={isGenerateModalVisible}
            onCancel={() => setIsGenerateModalVisible(false)}
            width={isMobile ? '90%' : 800}
            style={{
                top: isMobile ? 10 : 100,
                maxHeight: isMobile ? '90vh' : '80vh'
            }}
            footer={[
                <Button key="back" onClick={() => setIsGenerateModalVisible(false)}>
                    Отмена
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    icon={<ExperimentOutlined />}
                    onClick={() => {
                        const success = generateWeeklyMenu(generationSettings);
                        if (success) setIsGenerateModalVisible(false);
                    }}
                >
                    Сгенерировать меню
                </Button>
            ]}
        >
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                tabPosition={isMobile ? 'top' : 'left'}
                items={sections.map(s => ({
                    label: s.label,
                    key: s.key,
                    children: (
                        <div style={{
                            maxHeight: isMobile ? '60vh' : '65vh',
                            overflowY: 'auto',
                            padding: isMobile ? '0 8px' : '0 16px'
                        }}>
                            {s.children}
                        </div>
                    )
                }))}
            />

            <Divider />
            <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>Активные настройки:</Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <Tag icon={<ClockCircleOutlined />}>
                        Время: {generationSettings.maxCookingTime} мин
                    </Tag>
                    <Tag icon={<TeamOutlined />}>
                        Люди: {generationSettings.defaultPeopleCount}
                    </Tag>
                    {generationSettings.mealPrep.enabled && (
                        <Tag icon={<TeamOutlined />}>
                            Повторы: {generationSettings.mealPrep.maxReuse}x
                        </Tag>
                    )}
                    {generationSettings.preferences.map(p => (
                        <Tag key={p} color="orange">{p}</Tag>
                    ))}
                    {generationSettings.cuisines?.map(c => (
                        <Tag key={c} color="purple">{c}</Tag>
                    ))}
                </div>
            </Space>

            {errors.length > 0 && (
                <Alert
                    type="error"
                    message="Ошибки генерации"
                    description={
                        <ul>
                            {errors.map((error, idx) => (
                                <li key={idx}>
                                    {error.day}: {error.mealType} - не найден "{error.component}" для {error.users.join(', ')}
                                </li>
                            ))}
                        </ul>
                    }
                    style={{ marginTop: 16 }}
                />
            )}
        </Modal>
    );
};

export default GenerateMenuModal;