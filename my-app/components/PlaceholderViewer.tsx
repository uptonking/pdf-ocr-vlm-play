'use client';

import React from 'react';
import { Card, Image, Typography, Space } from 'antd';

const { Text } = Typography;

interface PlaceholderViewerProps {
    onUploadClick?: () => void;
}

const PlaceholderViewer: React.FC<PlaceholderViewerProps> = ({ onUploadClick }) => {
    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: '#0D1116',
            padding: '40px',
            borderRadius: '6px'
        }}>
            <Space direction="vertical" size={32} style={{ width: '100%', textAlign: 'center' }}>
                    <div style={{
                        padding: '20px 20px 0px 20px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}>
                        <img 
                            src="/25579720acb4.svg" 
                            alt="GitHub Octocat" 
                            style={{
                                width: '700px',
                                height: 'auto'
                            }}
                        />
                    </div>
                    {/* <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <Image
                            src="/QR_Code.png"
                            alt="QR Code"
                            style={{
                                width: '200px',
                                height: '200px',
                                borderRadius: '8px'
                            }}
                        />
                    </div> */}
                    
                    <div style={{ textAlign: 'center' }}>
                        <Text style={{ 
                            fontSize: '12px', 
                            color: '#999'
                        }}>
                            upload image or pdf and get text.
                        </Text>
                    </div>
                </Space>
        </div>
    );
};

export default PlaceholderViewer;