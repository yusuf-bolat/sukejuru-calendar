import { useEffect } from 'react'
import { router } from 'expo-router'
import { View, Text, ActivityIndicator } from 'react-native'
import { supabase } from '../lib/supabase'
import { Colors } from '../constants/Colors'

export default function Index() {
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session) {
          router.replace('/(tabs)/calendar')
        } else {
          router.replace('/(auth)/login')
        }
      } catch (error) {
        console.error('Error checking auth:', error)
        router.replace('/(auth)/login')
      }
    }

    checkAuth()
  }, [])

  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: Colors.background 
    }}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={{ 
        marginTop: 16, 
        color: Colors.textSecondary,
        fontSize: 16 
      }}>
        Loading Sukejuru...
      </Text>
    </View>
  )
}
