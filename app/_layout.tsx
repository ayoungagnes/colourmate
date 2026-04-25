import { ThemeProvider, Theme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import 'react-native-reanimated';

import { AppColors } from '@/src/ui/constants/theme';
import { migrateDb } from '@/src/infrastructure/db/migrate';
import { seedColours } from '@/src/infrastructure/seed/seedColours';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

const navTheme: Theme = {
  dark: true,
  colors: {
    primary: AppColors.interactive,
    background: AppColors.bg,
    card: AppColors.surface,
    text: AppColors.text,
    border: AppColors.border,
    notification: AppColors.action,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' },
    medium: { fontFamily: 'System', fontWeight: '500' },
    bold: { fontFamily: 'System', fontWeight: '700' },
    heavy: { fontFamily: 'System', fontWeight: '800' },
  },
};

function AppLoader({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [status, setStatus] = useState('Starting...');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setStatus('Running migrations...');
        await migrateDb(db);
        setStatus('Seeding colours...');
        await seedColours(db);
        setStatus('Done');
        setReady(true);
      } catch (e) {
        setError(String(e));
      } finally {
        SplashScreen.hideAsync();
      }
    })();
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: AppColors.bg }}>
        <Text style={{ color: AppColors.action, fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Startup Error</Text>
        <Text style={{ color: AppColors.text, fontSize: 13, textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: AppColors.bg }}>
        <ActivityIndicator size="large" color={AppColors.interactive} />
        <Text style={{ color: AppColors.text, marginTop: 16, fontSize: 14 }}>{status}</Text>
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="colourmate.db">
      <AppLoader>
        <GestureHandlerRootView>
          <ThemeProvider value={navTheme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              <Stack.Screen name="colour/[id]" options={{ title: 'Color Details' }} />
              <Stack.Screen name="recipe/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="painter/index" options={{ title: 'Paint Projects' }} />
              <Stack.Screen name="painter/[id]" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="light" />
          </ThemeProvider>
        </GestureHandlerRootView>
      </AppLoader>
    </SQLiteProvider>
  );
}
