import { render } from 'preact'
import { App } from './app.jsx'
import './index.css'

import { ThemeProvider } from "@material-tailwind/react";

export default function Main(InitializeLegController) {
    render(<ThemeProvider><App initializeLegController={InitializeLegController} /></ThemeProvider>, document.getElementById('app'))
}

