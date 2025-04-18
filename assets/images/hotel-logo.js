import React from 'react';
import { Image, StyleSheet } from 'react-native';

export default function HotelLogo({ size = 120 }) {
  const aspectRatio = 2; // 가로:세로 비율이 약 2:1인 로고
  const logoWidth = size * aspectRatio;
  const logoHeight = size;
  
  return (
    <Image
      source={require('../logo.png')}
      style={[styles.logo, { width: logoWidth, height: logoHeight }]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    alignSelf: 'center',
  },
}); 