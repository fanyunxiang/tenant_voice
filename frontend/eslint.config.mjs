import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextVitals,
  {
    files: [
      'src/views/admin/**/components/*Table.tsx',
      'src/views/admin/**/components/TableTopCreators.tsx',
    ],
    rules: {
      'react-hooks/incompatible-library': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];

export default config;
