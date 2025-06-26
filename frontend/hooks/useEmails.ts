import { useSocket } from './useSocket';

export function useEmails() {
  const { socket } = useSocket();

  const listEmails = async (params: {
    limit?: number;
    search?: string;
    inboxId?: string;
  } = {}) => {
    if (!socket?.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout: Failed to load emails within 30 seconds'));
      }, 30000);

      socket.emit('emails:list', params, (response: any) => {
        clearTimeout(timeout);
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error?.message || 'Failed to load emails'));
        }
      });
    });
  };

  const getEmail = async (emailId: string, inboxId: string) => {
    if (!socket?.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise<any>((resolve, reject) => {
      socket.emit('emails:get', { emailId, inboxId }, (response: any) => {
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error?.message || 'Failed to get email'));
        }
      });
    });
  };

  const downloadAttachment = async (emailId: string, attachmentId: string) => {
    if (!socket?.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise<any>((resolve, reject) => {
      socket.emit('emails:downloadAttachment', { emailId, attachmentId }, (response: any) => {
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error?.message || 'Failed to download attachment'));
        }
      });
    });
  };

  const markAsRead = async (emailId: string, inboxId: string) => {
    if (!socket?.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise<any>((resolve, reject) => {
      socket.emit('emails:markAsRead', { emailId, inboxId }, (response: any) => {
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error?.message || 'Failed to mark as read'));
        }
      });
    });
  };

  const getStats = async () => {
    if (!socket?.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise<any>((resolve, reject) => {
      socket.emit('emails:getStats', {}, (response: any) => {
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error?.message || 'Failed to get stats'));
        }
      });
    });
  };

  const getInboxes = async () => {
    if (!socket?.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise<any>((resolve, reject) => {
      socket.emit('emails:getInboxes', {}, (response: any) => {
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error?.message || 'Failed to get inboxes'));
        }
      });
    });
  };

  const sendTestEmail = async (inboxId?: string) => {
    if (!socket?.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise<any>((resolve, reject) => {
      socket.emit('emails:sendTestEmail', { inboxId }, (response: any) => {
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error?.message || 'Failed to send test email'));
        }
      });
    });
  };

  return {
    listEmails,
    getEmail,
    downloadAttachment,
    markAsRead,
    getStats,
    getInboxes,
    sendTestEmail
  };
}