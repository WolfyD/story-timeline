module.exports = {
  projects: [
    {
      displayName: 'timeline',
      testMatch: ['<rootDir>/__tests__/timeline.test.js'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
    },
    {
      displayName: 'app',
      testMatch: ['<rootDir>/__tests__/app.test.js'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.electron.js']
    },
    {
      displayName: 'database',
      testMatch: ['<rootDir>/__tests__/database.test.js'],
      testEnvironment: 'node'
    },
    {
      displayName: 'communication',
      testMatch: ['<rootDir>/__tests__/communication.test.js'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.electron.js']
    }
  ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(remixicon)/)'
  ],
  testTimeout: 30000
}; 