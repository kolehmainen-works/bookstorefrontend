import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        primary: {
            main: '#1e3a5f',
            contrastText: '#ffffff',
        },
        secondary: {
            main: '#8d6e63',
            contrastText: '#ffffff',
        },
        background: {
            default: '#f5f5f5',
        },
    },
});

export default theme;
