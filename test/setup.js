// Setup DOM environment for testing reactive.js
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
	url: "http://localhost",
	pretendToBeVisual: true,
	resources: "usable",
});

global.window = dom.window;
global.document = dom.window.document;
global.Event = dom.window.Event;
global.HTMLElement = dom.window.HTMLElement;
