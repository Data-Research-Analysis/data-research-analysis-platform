import { ITextExtractDriver } from "../interfaces/ITextExtractDriver.js";
import {TextractClient, AnalyzeDocumentCommand, Block, AnalyzeDocumentCommandOutput } from  "@aws-sdk/client-textract";
import CPage from "../types/CPage.js";
import { UtilityService } from "../services/UtilityService.js";
import { AWSService } from "../services/AWSService.js";
import { IAmazonDocumentRequest } from "../types/IAmazonDocumentRequest.js";
import CLine from "../types/CLine.js";
import CWord from "../types/CWord.js";
import { ExcelFileService } from "../services/ExcelFileService.js";
import { EPageType } from "../types/EPageType.js";

export class AmazonTextExtractDriver implements ITextExtractDriver {
    private static instance: AmazonTextExtractDriver;
    private textractClient: TextractClient;

    private constructor() {
    }
    public static getInstance(): AmazonTextExtractDriver {
        if (!AmazonTextExtractDriver.instance) {
            AmazonTextExtractDriver.instance = new AmazonTextExtractDriver();
        }
        return AmazonTextExtractDriver.instance;
    }
    public async initialize(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const region = UtilityService.getInstance().getConstants('AWS_S3_REGION');
            const accessKeyId = UtilityService.getInstance().getConstants('AWS_ACCESS_KEY_ID');
            const secretAccessKey = UtilityService.getInstance().getConstants('AWS_SECRET_ACCESS_KEY');
            this.textractClient = new TextractClient({ region, credentials: { accessKeyId, secretAccessKey } });
            return resolve();
        });
    }
    public async extractTextFromImage(dataChunks: Uint8Array[]): Promise<AnalyzeDocumentCommandOutput> {
        return new Promise<AnalyzeDocumentCommandOutput>(async (resolve, reject) => {
            await this.initialize();
            let params: IAmazonDocumentRequest = {
                Document: {
                    Bytes: Buffer.concat(dataChunks),
                },
                FeatureTypes: ["TABLES", "LAYOUT"],
            };
            const analyzeDoc = new AnalyzeDocumentCommand(params);
            try {
                const response = await this.textractClient.send(analyzeDoc);
                return resolve(response);
            } catch (error) {
                return reject(error);
            }
        });
    }
    public buildPageModel(fileName: string): Promise<[CPage, EPageType]> {
        return new Promise<[CPage, EPageType]>(async (resolve, reject) => {
            await this.initialize();
            const dataChunks = await AWSService.getInstance().getS3Object(fileName);
            const blocksData = await this.extractTextFromImage(dataChunks);
            let page = new CPage(0, 0, 0, 0, 0, 0);
            page.setWidth(parseInt(UtilityService.getInstance().getConstants('IMAGE_PAGE_WIDTH')));
            page.setHeight(parseInt(UtilityService.getInstance().getConstants('IMAGE_PAGE_HEIGHT')));
            page.setNumberOfVerticalCells(500);
            page.setNumberOfHorizontalCells(20);
            for (let i=0; i<page.getNumberOfVerticalCells(); i++) {
              let line: CLine = new CLine(page.getWidth(), page.getAverageWordHeight(), 0, 0);
              line.setIgnoreLine(true);
              for (let j=0; j<page.getNumberOfHorizontalCells(); j++) {
                let word: CWord = new CWord(page.getAverageWordWidth(), page.getAverageWordHeight(), j * page.getAverageWordWidth(), i * page.getAverageWordHeight(), ' ');
                line.addWord(word);
              }
              page.addLine(line);
            }
            const words = blocksData?.Blocks?.filter((word: Block) => word.BlockType === 'WORD');
            const table = blocksData?.Blocks?.filter((word: Block) => word.BlockType === 'TABLE');
            const tableTitle = blocksData?.Blocks?.filter((word: Block) => word.BlockType === 'TABLE_TITLE');
            const cells = blocksData?.Blocks?.filter((word: Block) => word.BlockType === 'CELL');
            if (table?.length) {
              tableTitle?.forEach((title: any) => {
                const tableTitleRelations = title?.Relationships?.map((rel: any) => rel?.Ids) || [];
                let foundTitle: Block[] = [];
                if (tableTitleRelations?.length && tableTitleRelations[0].length) {
                  foundTitle = words?.filter((actualWord: any) => {
                    for (let i=0; i<tableTitleRelations[0].length; i++) {
                      if (actualWord?.Relationships?.Ids.includes(tableTitleRelations[0][i])) {
                        return actualWord;
                      } else if (actualWord?.Id === tableTitleRelations[0][i]) {
                        return actualWord;
                      }
                    }
                  }) || [];
                } else if (title?.Id) {
                  foundTitle = words?.filter((actualWord: any) => {
                    if (actualWord?.Relationships?.Ids.includes(title.Id)) {
                      return actualWord;
                    } else if (actualWord?.Id === title.Id) {
                      return actualWord;
                    }
                  }) || [];
                }
                let relString = foundTitle?.length ? `${foundTitle.map((word:any) => word.Text).join(' ')}` : '';
                page.getLines()[1]?.getWords()[1]?.setText(`${relString}`);
              });
              cells?.forEach((cell: any) => {
                const relations = cell?.Relationships?.map((rel: any) => rel?.Ids) || [];
                let foundWords: Block[] = [];
                if (relations?.length && relations[0].length) {
                  foundWords = words?.filter((actualWord: any) => {
                    if (!actualWord.Text.match(/^\d+\.*\d*$/)) {
                      for (let i=0; i<relations[0].length; i++) {
                        if (actualWord?.Relationships?.Ids.includes(relations[0][i])) {
                          return actualWord;
                        } else if (actualWord?.Id === relations[0][i]) {
                          return actualWord;
                        }
                      }
                    }
                  }) || [];
                } else if (cell?.Id) {
                  foundWords = words?.filter((actualWord: any) => {
                    if (!actualWord.Text.match(/^\d+\.*\d*$/)) {
                      if (actualWord?.Relationships?.Ids.includes(cell.Id)) {
                        return actualWord;
                      } else if (actualWord?.Id === cell.Id) {
                        return actualWord;
                      }
                    }
                  }) || [];
                }
                let relString = foundWords?.length ? `${foundWords.map((word:any) => word.Text).join(' ')}` : '';
                const pattern = /^note\s[\S\s]+/gi
                relString = relString.replace(/^\-$/gi, '0');
                page.getLines()[cell.RowIndex + 2]?.getWords()[cell.ColumnIndex]?.setText(`${relString}`);
              });
              page.getLines().forEach((line) => {
                let numberOfWordsWithText = 0;
                line.getWords().forEach((word) => {
                  if (word.getText().trim().length) {
                    numberOfWordsWithText++;
                  }
                });
                if (numberOfWordsWithText) {
                  line.setIgnoreLine(false);
                }
              });
              return resolve([page, EPageType.TABLE]);
            } else {
              const lines = blocksData?.Blocks?.filter((line: Block) => line.BlockType === 'LINE');
              lines?.forEach((line: any, index: number) => {
                let numberOfWordsWithText = 0;
                line.Text.split(/[\s,]+/).forEach((wordText: string, wordIndex: number) => {
                  numberOfWordsWithText += wordText.trim().length ? 1 : 0;
                  page.getLines()[index].getWords()[wordIndex]?.setText(wordText);
                });
                if (numberOfWordsWithText) {
                  page.getLines()[index].setIgnoreLine(false);
                }
              });
              return resolve([page, EPageType.TEXT]);
            }
        });
    }
    public async convertExtractedTextToDataArray(page: CPage): Promise<any[]> {
        return new Promise<any[]>(async (resolve, reject) => {
            const data = await ExcelFileService.getInstance().convertToDataArray(page);
            return resolve(data);

        });
    }
}