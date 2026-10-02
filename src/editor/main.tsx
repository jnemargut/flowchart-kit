import { createRoot } from "react-dom/client";
import "../../vendor/sketch/tokens.css";
import "./styles.css";
import { App } from "./App";
import { installRichKeys } from "../../vendor/sketch/rich";

installRichKeys();

createRoot(document.getElementById("root")!).render(<App />);
