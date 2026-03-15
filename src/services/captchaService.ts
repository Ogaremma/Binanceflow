import axios from 'axios';

export interface CaptchaSolution {
  validateId: string;
  result: any;
}

/**
 * Service to interact with CapMonster Cloud API.
 */
export class CaptchaService {
  private apiKey: string;
  private baseUrl = 'https://api.capmonster.cloud';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Solves a Binance CAPTCHA using CapMonster's BinanceTask.
   */
  async solveBinanceCaptcha(websiteURL: string, websiteKey: string, validateId: string): Promise<string | null> {
    try {
      console.log(`[CaptchaService] Creating task for ${websiteURL}...`);
      
      const createTaskResponse = await axios.post(`${this.baseUrl}/createTask`, {
        clientKey: this.apiKey,
        task: {
          type: 'BinanceTaskProxyless',
          websiteURL: websiteURL,
          websiteKey: websiteKey,
          validateId: validateId
        }
      });

      if (createTaskResponse.data.errorId !== 0) {
        console.error(`[CaptchaService] Create task error: ${createTaskResponse.data.errorCode}`);
        return null;
      }

      const taskId = createTaskResponse.data.taskId;
      console.log(`[CaptchaService] Task created: ${taskId}. Waiting for result...`);

      // Poll for the result
      let result = null;
      const startTime = Date.now();
      while (!result && Date.now() - startTime < 60000) { // 60s timeout
        await new Promise(r => setTimeout(r, 3000));
        
        const getResultResponse = await axios.post(`${this.baseUrl}/getTaskResult`, {
          clientKey: this.apiKey,
          taskId: taskId
        });

        if (getResultResponse.data.errorId !== 0) {
          console.error(`[CaptchaService] Get result error: ${getResultResponse.data.errorCode}`);
          return null;
        }

        if (getResultResponse.data.status === 'ready') {
          result = getResultResponse.data.solution;
          console.log(`[CaptchaService] Captcha solved!`);
        }
      }

      return result;
    } catch (error: any) {
      console.error(`[CaptchaService] HTTP error: ${error.message}`);
      return null;
    }
  }
}
