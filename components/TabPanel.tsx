import { useState, ReactNode } from 'react'
import { ChatPanel } from './ChatPanel'
import { TodoPanel } from './TodoPanel'

interface TabPanelProps {
  view: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'
  currentDate: Date
  selectedDate?: Date
}

export function TabPanel({ view, currentDate, selectedDate }: TabPanelProps) {
  const [activeTab, setActiveTab] = useState<'ai-assistant' | 'todo-list'>('ai-assistant')

  const tabs = [
    {
      id: 'ai-assistant' as const,
      label: 'AI Assistant',
      icon: '🤖',
      component: <ChatPanel />
    },
    {
      id: 'todo-list' as const,
      label: 'Todo List',
      icon: '📝',
      component: <TodoPanel view={view} currentDate={currentDate} selectedDate={selectedDate} />
    }
  ]

  return (
    <div className="tab-panel-container">
      <div className="tab-header">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>
      
      <div className="tab-content">
        {tabs.find(tab => tab.id === activeTab)?.component}
      </div>
    </div>
  )
}
