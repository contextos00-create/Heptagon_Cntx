import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
} from '@tanstack/react-router';
import App from './App';

// Define the root route for TanStack Start / Router
export const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// Primary index route: Main whiteboard surface
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: App,
});

// Dynamic board route for deep linking
export const boardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/board/$boardId',
  component: App,
});

// Construct route tree
const routeTree = rootRoute.addChildren([indexRoute, boardRoute]);

// Create TanStack Router instance
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

// Register router instance for type safety in TanStack Start
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
