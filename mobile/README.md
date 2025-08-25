# Sukejuru Mobile

A React Native mobile app for academic calendar and todo management, built with Expo and Supabase.

## Features

- **Authentication**: Login and register with email/password
- **Calendar Management**: Create and view events with full calendar interface
- **Todo Management**: Priority-based task management with completion tracking
- **Profile Management**: Update user profile information
- **Real-time Notifications**: Event and task reminders
- **Cross-platform**: Works on both iOS and Android

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment Configuration**:
   - Copy `.env.example` to `.env`
   - Add your Supabase URL and anon key from your Supabase project settings

3. **Start the development server**:
   ```bash
   npx expo start
   ```

4. **Run on device/simulator**:
   - Install Expo Go app on your phone
   - Scan the QR code from the terminal
   - Or use `npx expo start --ios` / `npx expo start --android`

## Project Structure

```
mobile/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Authentication screens
│   │   ├── login.tsx      # Login screen
│   │   ├── register.tsx   # Register screen
│   │   └── +layout.tsx    # Auth layout
│   ├── (tabs)/            # Main app tabs
│   │   ├── calendar.tsx   # Calendar screen
│   │   ├── todo.tsx       # Todo management
│   │   ├── profile.tsx    # Profile settings
│   │   └── +layout.tsx    # Tab layout
│   ├── index.tsx          # Auth check/loading screen
│   └── +layout.tsx        # Root layout
├── lib/                   # Utility libraries
│   ├── supabase.ts        # Supabase client
│   └── notifications.ts   # Notification service
├── constants/             # App constants
│   └── Colors.ts          # Color scheme
└── components/            # Reusable components (future)
```

## Database Schema

The app uses the same Supabase database as the web version:
- `profiles` - User profile information
- `events` - Calendar events
- `assignments` - Todo tasks/assignments

## Deployment

For production deployment:

1. **Build for app stores**:
   ```bash
   npx eas build --platform ios
   npx eas build --platform android
   ```

2. **Submit to stores**:
   ```bash
   npx eas submit --platform ios
   npx eas submit --platform android
   ```

## Tech Stack

- **React Native** with **Expo Router** for navigation
- **TypeScript** for type safety
- **Supabase** for backend and authentication
- **Expo Notifications** for push notifications
- **React Native Calendars** for calendar interface
- **Vector Icons** for UI icons

## Features in Detail

### Authentication
- Email/password registration and login
- Profile creation during registration
- Secure session management with Supabase

### Calendar
- Monthly calendar view with event markers
- Create events with title, description, location, and time
- View events for selected dates
- Event notifications 10 minutes before start time

### Todo Management
- Priority-based task system (High, Medium, Low)
- Task completion tracking
- Filter by pending/completed/all
- Due date and time support

### Profile
- Edit name and profile information
- View app usage statistics
- Secure sign out functionality

## Permissions

The app requires the following permissions:
- **Notifications**: For event and task reminders
- **Calendar**: For calendar access (future feature)

These are configured in `app.json` and will be requested at runtime.
