import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import AuthStack from './AuthStack';
import EmployeeStack from './EmployeeStack';
import AdminStack from './AdminStack';
import PartyStack from './PartyStack';
import { navigationRef } from './navigationRef';
import { colors } from '../theme';

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {!user ? <AuthStack /> : user.mode === 'admin' ? <AdminStack /> : user.mode === 'party' ? <PartyStack /> : <EmployeeStack />}
    </NavigationContainer>
  );
}
