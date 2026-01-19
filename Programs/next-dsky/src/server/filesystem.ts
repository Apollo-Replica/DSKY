import * as fs from 'fs';

export interface WatcherHandle {
    getWatcher: () => fs.FSWatcher | undefined
    cancel: () => void
}

export const createWatcher = (watchPath: string, callback: () => void): WatcherHandle => {
    let watcher: fs.FSWatcher | undefined
    let cancelled = false
    
    const cancel = () => {
        cancelled = true
        if (watcher) {
            watcher.close()
            watcher = undefined
        }
    }
    
    const getWatcher = () => watcher
    
    // Start the watcher loop asynchronously
    const startWatcher = async () => {
        while (!watcher && !cancelled) {
            try {
                watcher = fs.watch(watchPath, callback);
                // Trigger callback on start to get initial state
                callback();
                console.log(`Watcher created successfully for ${watchPath}`);
                return
            } catch (error: any) {
                if (!cancelled) {
                    console.error(`Unable to create watcher for ${watchPath}: ${error.message}`);
                    // Wait but check cancelled periodically
                    for (let i = 0; i < 50 && !cancelled; i++) {
                        await new Promise((resolve) => setTimeout(resolve, 100));
                    }
                }
            }
        }
    }
    
    // Fire and forget - don't await
    startWatcher()
    
    return { getWatcher, cancel }
};
