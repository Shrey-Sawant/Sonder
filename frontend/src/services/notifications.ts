export async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('This browser does not support notifications.');
        return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        console.log('Notification permission granted.');
        // Here we would typically register a service worker and get a push subscription
        // For demonstration, we just log it. In a full implementation, we'd send the subscription to the backend.
        if ('serviceWorker' in navigator) {
            try {
                // Assuming sw.js exists in public folder
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered', registration);
            } catch(e) {
                console.error('SW registration failed', e);
            }
        }
    }
}
