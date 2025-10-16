import CLine from "./CLine.js";

export default class CPage {
    private width: number;
    private height: number;
    private averageWordWidth: number;
    private averageWordHeight: number;
    private lines: CLine[];
    private numberOfHorizontalCells: number;
    private numberOfVerticalCells: number;

    constructor(width: number, height: number, averageWordWidth: number, averageWordHeight: number, numberOfHorizontalCells: number, numberOfVerticalCells: number) {
        this.width = width;
        this.height = height;
        this.lines = [];
        this.averageWordWidth = averageWordWidth;
        this.averageWordHeight = averageWordHeight;
        this.numberOfHorizontalCells = numberOfHorizontalCells;
        this.numberOfVerticalCells = numberOfVerticalCells;
    }

    getWidth() {
        return this.width;
    }

    getHeight() {
        return this.height;
    }

    getAverageWordWidth() {
        return this.averageWordWidth;
    }

    getAverageWordHeight() {
        return this.averageWordHeight;
    }

    getLines() {
        return this.lines;
    }

    getNumberOfHorizontalCells() {
        return this.numberOfHorizontalCells;
    }

    getNumberOfVerticalCells() {
        return this.numberOfVerticalCells;
    }
        
    addLine(line: CLine) {
        this.lines.push(line);
    }

    setWidth(width: number) {
        this.width = width;
    }

    setHeight(height: number) {
        this.height = height;
    }

    setAverageWordWidth(averageWordWidth: number) {
        this.averageWordWidth = averageWordWidth;
    }

    setAverageWordHeight(averageWordHeight: number) {
        this.averageWordHeight = averageWordHeight;
    }

    setNumberOfHorizontalCells(numberOfHorizontalCells: number) {
        this.numberOfHorizontalCells = numberOfHorizontalCells;
    }

    setNumberOfVerticalCells(numberOfVerticalCells: number) {
        this.numberOfVerticalCells = numberOfVerticalCells;
    }
}