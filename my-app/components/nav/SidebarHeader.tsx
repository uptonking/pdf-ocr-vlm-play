'use client';

import React from 'react';
import { Button } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';

interface SidebarHeaderProps {
    collapsed: boolean;
    onToggle: () => void;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({ collapsed, onToggle }) => {
    return (
        <div style={{
            height: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding: collapsed ? '0' : '0 16px',
            borderBottom: '1px solid #d9d9d9',
            background: '#1890ff'
        }}>
            {!collapsed && (
                <span style={{ color: 'white', fontWeight: 600, fontSize: 16 }}>
                    PDF OCR
                </span>
            )}
            <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={onToggle}
                style={{ color: 'white' }}
            />
        </div>
    );
};

export default SidebarHeader;
