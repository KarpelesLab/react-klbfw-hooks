// Test runner for SSR implementation with React Router DOM v7
// Based on the sample_from_chatgpt.js file

// Import required libraries
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} = require("react-router-dom");
const { Helmet } = require("react-helmet");

// Import our test routes
const { routes } = require('./tests.js');

// Mock klbfw functions
global.getUuid = () => 'test-uuid-123';
global.getPrefix = () => '';
global.getPath = () => '/test';
global.getUrl = () => ({ 
  query: '',
  host: 'example.com',
  scheme: 'https'
});

// Helper function to create a fetch request
function createFetchRequest(url, query) {
  const headers = new Headers();
  headers.append("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
  
  return new Request(`${url}${query ? `?${query}` : ""}`, {
    method: "GET",
    headers: headers,
    redirect: "manual"
  });
}

// Create our own implementation based on ssr.js
// We can't directly import the ES module
function makeRenderer(routes) {
  return async function(cbk) {
    const result = { uuid: global.getUuid(), initial: {} };
    const pathname = global.getPath();
    const search = global.getUrl().query || "";
    
    try {
      // Create a static handler from the routes
      const { query } = createStaticHandler(routes);
      
      // Get URL information including host and scheme from getUrl()
      const urlInfo = global.getUrl();
      const scheme = urlInfo.scheme || 'https';
      const host = urlInfo.host || 'localhost';
      
      // Construct the full URL with scheme, host and path
      const fullUrl = `${scheme}://${host}${pathname}`;
      
      // Create a fetch request from the current URL
      const headers = new Headers();
      headers.append("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
      const fetchRequest = new Request(`${fullUrl}${search ? `?${search}` : ""}`, {
        method: "GET",
        headers: headers,
        redirect: "manual"
      });
      
      // Run the query to get data and check for redirects
      const context = await query(fetchRequest);
      
      // Check if the context is a Response (which could be a redirect)
      if (context instanceof Response) {
        // Check if it's a redirect status code
        if ([301, 302, 303, 307, 308].includes(context.status)) {
          result.redirect = context.headers.get("Location");
          result.statusCode = context.status;
          cbk(result);
          return;
        }
      }
      
      // If no redirect, create a static router with the data context
      const router = createStaticRouter(routes, context);
      
      // Create the app with our Context provider and StaticRouterProvider
      const app = React.createElement(
        React.createContext({}).Provider,
        { value: {} },
        React.createElement(
          StaticRouterProvider, 
          { 
            router: router,
            context: context
          }
        )
      );
      
      // Render the application using ReactDOMServer
      result.app = ReactDOMServer.renderToString(app);
      
      // Extract Helmet metadata
      Helmet.canUseDOM = false;
      const helmet = Helmet.renderStatic();
      
      result.title = helmet.title ? helmet.title.toString() : null;
      result.meta = helmet.meta ? helmet.meta.toString() : null;
      result.script = helmet.script ? helmet.script.toString() : null;
      result.link = helmet.link ? helmet.link.toString() : null;
      result.bodyAttributes = helmet.bodyAttributes ? helmet.bodyAttributes.toString() : null;
      result.htmlAttributes = helmet.htmlAttributes ? helmet.htmlAttributes.toString() : null;
      
      cbk(result);
    } catch (error) {
      console.error("Error in renderer:", error);
      result.error = error;
      cbk(result);
    }
  };
}

// Test for HTML rendering
async function testHtmlRendering() {
  console.log('\nTest: Home Page HTML Rendering');
  
  // Override the path for this test
  global.getPath = () => '/';
  
  // Create a renderer
  const renderer = makeRenderer(routes);
  
  // Execute the renderer
  return new Promise((resolve) => {
    renderer((result) => {
      console.log('Test results:');
      console.log('- Has redirect:', !!result.redirect);
      console.log('- Has HTML:', !!result.app);
      console.log('- Has title:', !!result.title);
      console.log('- Sample HTML:', result.app ? result.app.substring(0, 50) + '...' : 'None');
      
      // Check if the result contains expected content
      const hasTitle = result.title && result.title.includes('Home Page');
      const hasHomeHeading = result.app && result.app.includes('<h1>Home</h1>');
      
      if (!result.redirect && result.app && hasTitle && hasHomeHeading) {
        console.log('✅ PASSED: Home page rendered correctly');
        resolve(true);
      } else {
        console.log('❌ FAILED: Home page not rendered correctly');
        resolve(false);
      }
    });
  });
}

// Test for redirect handling
async function testRedirectHandling() {
  console.log('\nTest: Redirect Handling');
  
  // Override the path for this test
  global.getPath = () => '/redirect';
  
  // Create a renderer
  const renderer = makeRenderer(routes);
  
  // Execute the renderer
  return new Promise((resolve) => {
    renderer((result) => {
      console.log('Test results:');
      console.log('- Has redirect:', !!result.redirect);
      console.log('- Redirect URL:', result.redirect);
      console.log('- Status code:', result.statusCode);
      console.log('- Has HTML:', !!result.app);
      
      if (result.redirect === '/about' && result.statusCode === 301 && !result.app) {
        console.log('✅ PASSED: Redirect handled correctly');
        resolve(true);
      } else {
        console.log('❌ FAILED: Redirect not handled correctly');
        resolve(false);
      }
    });
  });
}

// Run all tests
async function runTests() {
  try {
    const htmlTestPassed = await testHtmlRendering();
    const redirectTestPassed = await testRedirectHandling();
    
    console.log('\n========== TEST SUMMARY ==========');
    const passCount = (htmlTestPassed ? 1 : 0) + (redirectTestPassed ? 1 : 0);
    console.log(`Tests Passed: ${passCount}/2`);
    
    if (passCount === 2) {
      console.log('✅ ALL TESTS PASSED - The SSR implementation correctly:');
      console.log('  1. Renders HTML content for regular pages with proper metadata');
      console.log('  2. Detects and handles redirects with proper status codes');
    } else {
      console.log('❌ SOME TESTS FAILED - See details above');
    }
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Start the tests
runTests();