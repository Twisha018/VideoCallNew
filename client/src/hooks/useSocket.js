// // hooks/useSocket.js - Enhanced socket hook with WebRTC support
// import { useEffect, useState, useCallback, useRef } from 'react';
// import { io } from 'socket.io-client';

// export const useSocket = (serverUrl = null) => {
//   const [socket, setSocket] = useState(null);
//   const [isConnected, setIsConnected] = useState(false);
//   const [connectionError, setConnectionError] = useState(null);
//   const [reconnectAttempts, setReconnectAttempts] = useState(0);
//   const socketRef = useRef(null);
//   const maxReconnectAttempts = 5;

//   // Determine server URL
//   const getServerUrl = useCallback(() => {
//     // If server URL is provided directly, use it
//     if (serverUrl) return serverUrl;
    
//     // Check for environment variable (set by Render or other hosting)
//     if (process.env.REACT_APP_SERVER_URL) {
//       return process.env.REACT_APP_SERVER_URL;
//     }
    
//     // Check if we're in development or production
//     if (process.env.NODE_ENV === 'development') {
//       // For development, try to detect the server IP
//       const hostname = window.location.hostname;
//       const serverPort = '3001';
      
//       // If accessing via IP, use the same IP for socket
//       if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
//         return `http://${hostname}:${serverPort}`;
//       }
      
//       // Default to localhost for local development
//       return `http://localhost:${serverPort}`;
//     }
    
//     // For production with no explicit URL, use the same origin
//     // This works for Render and similar hosting where frontend/backend are on same domain
//     return window.location.origin;
//   }, [serverUrl]);

//   useEffect(() => {
//     const serverURL = getServerUrl();
//     console.log('Connecting to server:', serverURL);

//     // Enhanced Socket.io configuration for WebRTC support
//     const socketConfig = {
//       transports: ['websocket', 'polling'],
//       forceNew: true,
//       reconnection: true,
//       reconnectionAttempts: maxReconnectAttempts,
//       reconnectionDelay: 1000,
//       reconnectionDelayMax: 5000,
//       timeout: 20000, // Increased timeout for WebRTC
//       withCredentials: false,
//       upgrade: true,
//       rememberUpgrade: true,
//       // Additional options for WebRTC compatibility
//       autoConnect: true,
//       multiplex: true,
//       // Enable binary support for WebRTC data
//       binary: true,
//       // Increase maxHttpBufferSize for WebRTC signaling
//       maxHttpBufferSize: 1e8
//     };

//     // Create socket connection
//     const newSocket = io(serverURL, socketConfig);
//     socketRef.current = newSocket;
//     setSocket(newSocket);

//     // Connection event handlers
//     newSocket.on('connect', () => {
//       console.log('✅ Connected to server:', newSocket.id);
//       setIsConnected(true);
//       setConnectionError(null);
//       setReconnectAttempts(0);
      
//       // Emit a test event to ensure connection is working
//       newSocket.emit('connection-test', { timestamp: Date.now() });
//     });

//     newSocket.on('disconnect', (reason) => {
//       console.log('❌ Disconnected from server:', reason);
//       setIsConnected(false);
      
//       // Set error message based on disconnect reason
//       if (reason === 'io server disconnect') {
//         setConnectionError('Server disconnected the connection');
//       } else if (reason === 'transport close') {
//         setConnectionError('Connection lost');
//       } else if (reason === 'transport error') {
//         setConnectionError('Transport error - check network connection');
//       } else {
//         setConnectionError(`Disconnected: ${reason}`);
//       }
//     });

//     newSocket.on('connect_error', (error) => {
//       console.error('❌ Connection error:', error);
//       setIsConnected(false);
      
//       // More detailed error handling
//       let errorMessage = 'Connection failed';
//       if (error.message) {
//         errorMessage = error.message;
//       } else if (error.type) {
//         errorMessage = `Connection error: ${error.type}`;
//       }
      
//       // Increment reconnect attempts
//       setReconnectAttempts(prev => {
//         const newAttempts = prev + 1;
        
//         if (newAttempts >= maxReconnectAttempts) {
//           setConnectionError(`${errorMessage}. Failed after ${maxReconnectAttempts} attempts. Please check your network and server.`);
//         } else {
//           setConnectionError(`${errorMessage}. Retrying... (${newAttempts}/${maxReconnectAttempts})`);
//         }
        
//         return newAttempts;
//       });
//     });

//     newSocket.on('reconnect', (attemptNumber) => {
//       console.log(`✅ Reconnected after ${attemptNumber} attempts`);
//       setConnectionError(null);
//       setReconnectAttempts(0);
//     });

//     newSocket.on('reconnect_error', (error) => {
//       console.error('❌ Reconnection error:', error);
//     });

//     newSocket.on('reconnect_failed', () => {
//       console.error('❌ Reconnection failed');
//       setConnectionError('Failed to reconnect to server. Please refresh the page.');
//     });

//     // Custom error handler
//     newSocket.on('error', (error) => {
//       console.error('❌ Socket error:', error);
//       setConnectionError(`Server error: ${error.message || error}`);
//     });

//     // WebRTC-specific event handlers
//     newSocket.on('call-failed', (error) => {
//       console.error('❌ Call failed:', error);
//       setConnectionError(`Call failed: ${error.message || error}`);
//     });

//     newSocket.on('peer-connection-failed', (error) => {
//       console.error('❌ Peer connection failed:', error);
//       setConnectionError(`Peer connection failed: ${error.message || error}`);
//     });

//     // Connection test response
//     newSocket.on('connection-test-response', (data) => {
//       console.log('📡 Connection test successful:', data);
//     });

//     // Cleanup function
//     return () => {
//       console.log('🧹 Cleaning up socket connection');
//       if (socketRef.current) {
//         socketRef.current.removeAllListeners();
//         socketRef.current.disconnect();
//         socketRef.current = null;
//       }
//       setSocket(null);
//       setIsConnected(false);
//     };
//   }, [getServerUrl, maxReconnectAttempts]);

//   // Enhanced emit function with connection check and retry logic
//   const emit = useCallback((event, data, callback) => {
//     if (socketRef.current && isConnected) {
//       console.log(`📤 Emitting ${event}:`, data);
      
//       // If callback provided, use it
//       if (callback) {
//         socketRef.current.emit(event, data, callback);
//       } else {
//         socketRef.current.emit(event, data);
//       }
//       return true;
//     } else {
//       console.warn(`⚠️ Cannot emit ${event}: Socket not connected`);
      
//       // For critical events like call initialization, show specific error
//       if (event.includes('call') || event.includes('offer') || event.includes('answer')) {
//         setConnectionError('Cannot initialize call: Socket connection failed');
//       }
      
//       return false;
//     }
//   }, [isConnected]);

//   // On function for event listeners
//   const on = useCallback((event, callback) => {
//     if (socketRef.current) {
//       console.log(`📥 Listening for ${event}`);
//       socketRef.current.on(event, callback);
//       return true;
//     }
//     return false;
//   }, []);

//   // Off function for removing event listeners
//   const off = useCallback((event, callback) => {
//     if (socketRef.current) {
//       console.log(`🔇 Removing listener for ${event}`);
//       socketRef.current.off(event, callback);
//       return true;
//     }
//     return false;
//   }, []);

//   // Manual reconnect function
//   const reconnect = useCallback(() => {
//     if (socketRef.current) {
//       console.log('🔄 Manual reconnect triggered');
//       setReconnectAttempts(0);
//       setConnectionError(null);
//       socketRef.current.connect();
//       return true;
//     }
//     return false;
//   }, []);

//   // Test connection function
//   const testConnection = useCallback(() => {
//     if (socketRef.current && isConnected) {
//       console.log('🧪 Testing connection...');
//       socketRef.current.emit('connection-test', { timestamp: Date.now() });
//       return true;
//     }
//     return false;
//   }, [isConnected]);

//   // Get connection status
//   const getConnectionStatus = useCallback(() => {
//     return {
//       isConnected,
//       socketId: socketRef.current?.id,
//       serverUrl: getServerUrl(),
//       error: connectionError,
//       reconnectAttempts
//     };
//   }, [isConnected, connectionError, reconnectAttempts, getServerUrl]);

//   return {
//     socket,
//     isConnected,
//     connectionError,
//     reconnectAttempts,
//     emit,
//     on,
//     off,
//     reconnect,
//     testConnection,
//     getConnectionStatus
//   };
// };



// hooks/useSocket.js - Enhanced socket hook with WebRTC support
import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

export const useSocket = (serverUrl = null) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const socketRef = useRef(null);
  const maxReconnectAttempts = 5;

  // Determine server URL
  const getServerUrl = useCallback(() => {
    // If server URL is provided directly, use it
    if (serverUrl) return serverUrl;
    
    // Check for environment variable (set by Render or other hosting)
    if (process.env.REACT_APP_SERVER_URL) {
      return process.env.REACT_APP_SERVER_URL;
    }
    
    // Check if we're in development or production
    if (process.env.NODE_ENV === 'development') {
      // For development, try to detect the server IP
      const hostname = window.location.hostname;
      const serverPort = '3001';
      
      // If accessing via IP, use the same IP for socket
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return `http://${hostname}:${serverPort}`;
      }
      
      // Default to localhost for local development
      return `http://localhost:${serverPort}`;
    }
    
    // For production with no explicit URL, use the same origin
    // This works for Render and similar hosting where frontend/backend are on same domain
    return window.location.origin;
  }, [serverUrl]);

  useEffect(() => {
    const serverURL = getServerUrl();
    console.log('Connecting to server:', serverURL);

    // Enhanced Socket.io configuration for WebRTC support
    const socketConfig = {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000, // Increased timeout for WebRTC
      withCredentials: false,
      upgrade: true,
      rememberUpgrade: true,
      // Additional options for WebRTC compatibility
      autoConnect: true,
      multiplex: true,
      // Enable binary support for WebRTC data
      binary: true,
      // Increase maxHttpBufferSize for WebRTC signaling
      maxHttpBufferSize: 1e8
    };

    // Create socket connection
    const newSocket = io(serverURL, socketConfig);
    socketRef.current = newSocket;
    setSocket(newSocket);

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('✅ Connected to server:', newSocket.id);
      setIsConnected(true);
      setConnectionError(null);
      setReconnectAttempts(0);
      
      // Emit a test event to ensure connection is working
      newSocket.emit('connection-test', { timestamp: Date.now() });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server:', reason);
      setIsConnected(false);
      
      // Set error message based on disconnect reason
      if (reason === 'io server disconnect') {
        setConnectionError('Server disconnected the connection');
      } else if (reason === 'transport close') {
        setConnectionError('Connection lost');
      } else if (reason === 'transport error') {
        setConnectionError('Transport error - check network connection');
      } else {
        setConnectionError(`Disconnected: ${reason}`);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setIsConnected(false);
      
      // More detailed error handling
      let errorMessage = 'Connection failed';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.type) {
        errorMessage = `Connection error: ${error.type}`;
      }
      
      // Increment reconnect attempts
      setReconnectAttempts(prev => {
        const newAttempts = prev + 1;
        
        if (newAttempts >= maxReconnectAttempts) {
          setConnectionError(`${errorMessage}. Failed after ${maxReconnectAttempts} attempts. Please check your network and server.`);
        } else {
          setConnectionError(`${errorMessage}. Retrying... (${newAttempts}/${maxReconnectAttempts})`);
        }
        
        return newAttempts;
      });
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      setConnectionError(null);
      setReconnectAttempts(0);
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('❌ Reconnection error:', error);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed');
      setConnectionError('Failed to reconnect to server. Please refresh the page.');
    });

    // Custom error handler
    newSocket.on('error', (error) => {
      console.error('❌ Socket error:', error);
      setConnectionError(`Server error: ${error.message || error}`);
    });

    // WebRTC-specific event handlers
    newSocket.on('call-failed', (error) => {
      console.error('❌ Call failed:', error);
      setConnectionError(`Call failed: ${error.message || error}`);
    });

    newSocket.on('peer-connection-failed', (error) => {
      console.error('❌ Peer connection failed:', error);
      setConnectionError(`Peer connection failed: ${error.message || error}`);
    });

    // Connection test response
    newSocket.on('connection-test-response', (data) => {
      console.log('📡 Connection test successful:', data);
    });

    // Add connection test response handler
    newSocket.on('connection-test', (data) => {
      console.log('📡 Received connection test, responding:', data);
      newSocket.emit('connection-test-response', { 
        ...data, 
        response: 'Connection test successful',
        clientTimestamp: Date.now()
      });
    });

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up socket connection');
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setIsConnected(false);
    };
  }, [getServerUrl, maxReconnectAttempts]);

  // Enhanced emit function with connection check and retry logic
  const emit = useCallback((event, data, callback) => {
    if (socketRef.current && isConnected) {
      console.log(`📤 Emitting ${event}:`, data);
      
      // If callback provided, use it
      if (callback) {
        socketRef.current.emit(event, data, callback);
      } else {
        socketRef.current.emit(event, data);
      }
      return true;
    } else {
      console.warn(`⚠️ Cannot emit ${event}: Socket not connected`);
      
      // For critical events like call initialization, show specific error
      if (event.includes('call') || event.includes('offer') || event.includes('answer')) {
        setConnectionError('Cannot initialize call: Socket connection failed');
      }
      
      return false;
    }
  }, [isConnected]);

  // On function for event listeners
  const on = useCallback((event, callback) => {
    if (socketRef.current) {
      console.log(`📥 Listening for ${event}`);
      socketRef.current.on(event, callback);
      return true;
    }
    return false;
  }, []);

  // Off function for removing event listeners
  const off = useCallback((event, callback) => {
    if (socketRef.current) {
      console.log(`🔇 Removing listener for ${event}`);
      socketRef.current.off(event, callback);
      return true;
    }
    return false;
  }, []);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('🔄 Manual reconnect triggered');
      setReconnectAttempts(0);
      setConnectionError(null);
      socketRef.current.connect();
      return true;
    }
    return false;
  }, []);

  // Test connection function
  const testConnection = useCallback(() => {
    if (socketRef.current && isConnected) {
      console.log('🧪 Testing connection...');
      socketRef.current.emit('connection-test', { timestamp: Date.now() });
      return true;
    }
    return false;
  }, [isConnected]);

  // Get connection status
  const getConnectionStatus = useCallback(() => {
    return {
      isConnected,
      socketId: socketRef.current?.id,
      serverUrl: getServerUrl(),
      error: connectionError,
      reconnectAttempts
    };
  }, [isConnected, connectionError, reconnectAttempts, getServerUrl]);

  return {
    socket,
    isConnected,
    connectionError,
    reconnectAttempts,
    emit,
    on,
    off,
    reconnect,
    testConnection,
    getConnectionStatus
  };
};