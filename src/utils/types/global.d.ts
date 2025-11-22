declare global {
  type Feature = 'summarizer' | 'translator' | 'language-model';
  type FeatureStatus = {
    [key in Feature]: {
      success: boolean;
      message: string;
      model: any;
      model2?: any;
    };
  };
}

export {};
