import * as Notifications from 'expo-notifications'

export class MobileNotificationService {
  private static instance: MobileNotificationService

  static getInstance(): MobileNotificationService {
    if (!MobileNotificationService.instance) {
      MobileNotificationService.instance = new MobileNotificationService()
    }
    return MobileNotificationService.instance
  }

  async scheduleEventNotification(
    event: any
  ) {
    const eventDate = new Date(`${event.start_date}T${event.start_time || '09:00:00'}`)
    const notificationDate = new Date(eventDate.getTime() - (10 * 60 * 1000)) // 10 minutes before
    
    if (notificationDate <= new Date()) {
      return // Don't schedule past notifications
    }

    const secondsFromNow = Math.floor((notificationDate.getTime() - Date.now()) / 1000)

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `📅 Upcoming Event`,
        body: `${event.title} starts in 10 minutes`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsFromNow > 0 ? secondsFromNow : 1,
        repeats: false
      },
    })

    return notificationId
  }

  static async scheduleEventNotification(
    eventTitle: string,
    eventDate: Date,
    minutesBefore: number = 10
  ) {
    const notificationDate = new Date(eventDate.getTime() - (minutesBefore * 60 * 1000))
    
    if (notificationDate <= new Date()) {
      return // Don't schedule past notifications
    }

    const secondsFromNow = Math.floor((notificationDate.getTime() - Date.now()) / 1000)

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `📅 Upcoming Event`,
        body: `${eventTitle} starts in ${minutesBefore} minutes`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsFromNow > 0 ? secondsFromNow : 1,
        repeats: false
      },
    })

    return notificationId
  }

  static async scheduleTodoNotification(
    todoTitle: string,
    dueDate: Date,
    priority: 'high' | 'medium' | 'low'
  ) {
    const schedules = {
      high: [1440, 300, 60, 30, 10], // 1 day, 5hr, 1hr, 30min, 10min
      medium: [300, 60, 10], // 5hr, 1hr, 10min  
      low: [120, 10], // 2hr, 10min
    }

    const notifications = []
    for (const minutes of schedules[priority]) {
      const notificationDate = new Date(dueDate.getTime() - (minutes * 60 * 1000))
      
      if (notificationDate > new Date()) {
        const secondsFromNow = Math.floor((notificationDate.getTime() - Date.now()) / 1000)

        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: `📝 Todo Reminder`,
            body: `${todoTitle} is due in ${minutes < 60 ? minutes + ' minutes' : Math.floor(minutes/60) + ' hours'}`,
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: secondsFromNow > 0 ? secondsFromNow : 1,
            repeats: false
          },
        })
        notifications.push(notificationId)
      }
    }

    return notifications
  }

  static async cancelNotification(notificationId: string) {
    await Notifications.cancelScheduledNotificationAsync(notificationId)
  }

  static async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync()
  }
}
