import { lazy, ComponentType } from 'react';

/**
 * Robust wrapper for React.lazy that auto-reloads the page if dynamic import fails
 * due to deployment stale chunk hashes (e.g. "Failed to fetch dynamically imported module").
 */
export function lazyWithRetry<T extends ComponentType<any>>(
    componentImport: () => Promise<{ default: T }>
) {
    return lazy(async () => {
        const pageHasBeenReloaded = sessionStorage.getItem('page_reloaded_for_chunk_error');

        try {
            const component = await componentImport();
            // Clear session storage flag on successful module load
            sessionStorage.removeItem('page_reloaded_for_chunk_error');
            return component;
        } catch (error: any) {
            const isChunkLoadError =
                error?.message?.includes('Failed to fetch dynamically imported module') ||
                error?.name === 'ChunkLoadError' ||
                error?.message?.includes('Importing a module script failed') ||
                error?.message?.includes('error loading dynamically imported module');

            if (isChunkLoadError && !pageHasBeenReloaded) {
                console.warn('Chunk load error detected after deployment. Reloading page to fetch latest manifest...', error);
                sessionStorage.setItem('page_reloaded_for_chunk_error', 'true');
                window.location.reload();
                // Return a promise that never resolves while page reloads
                return new Promise<{ default: T }>(() => { });
            }

            throw error;
        }
    });
}
