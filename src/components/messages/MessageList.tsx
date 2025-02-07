import React, { useRef, useEffect, useState } from 'react'
import LoadingSpinner from '../LoadingSpinner'

const MessageList = () => {
  const messageListRef = useRef(null)
  const [isLoading, setIsLoading] = useState(true)

  const scrollToBottom = () => {
    const messageList = messageListRef.current
    if (messageList) {
      messageList.scrollTop = messageList.scrollHeight
    }
  }

  useEffect(() => {
    setIsLoading(true)
    fetchMessages().finally(() => setIsLoading(false))
  }, [selectedChannel])

  useEffect(() => {
    scrollToBottom()
  }, [messages, selectedChannel]) // Scroll when messages change or channel changes

  return (
    <div ref={messageListRef} className="message-list">
      {isLoading ? (
        <div className="flex justify-center items-center h-full">
          <LoadingSpinner />
        </div>
      ) : (
        // Message list content
      )}
    </div>
  )
}

export default MessageList 