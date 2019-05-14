import console = require('console');
import { Toast } from 'native-base';
import { Action, Dispatch } from 'redux';
import ShortId from 'shortid';

import { EIMServiceAdapter } from '../../eim-service';
import { IEimApp } from '../states/IEimAppListState';
import INavigateController from './INavigateController';

interface ISourceEimApp {
    system: {};
    properties: {
        id: string;
        name: string;
        description: string;
    };
}

interface IGetAppListResponse {
    apps: ISourceEimApp[];
}

export const SET_APP_LIST = ShortId();
export interface ISetAppListAction extends Action {
    appList: IEimApp[];
}
export const createSetAppListAction = (appList: IEimApp[]): ISetAppListAction => {
    return {
        appList,
        type: SET_APP_LIST,
    };
};

export const LOAD_APP_LIST = ShortId();

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ILoadAppListAction extends Action {
}
export const createLoadAppListAction =
    async (dispatch: Dispatch, navigateActions: INavigateController): Promise<void> => {
        const { siteDomain, siteName, tokens, appKeyPrefix } = navigateActions.getLinkState();
        if (!siteDomain || !tokens || !appKeyPrefix) { return; }
        dispatch({
            type: LOAD_APP_LIST,
        });
        // アプリ一覧の取得
        await (async () => {
            const sa = new EIMServiceAdapter(siteDomain);
            try {
                const response = await sa.getAppList(tokens);
                const responseObj = JSON.parse(response.body) as IGetAppListResponse;
                const appList = responseObj.apps
                    .filter((a) => a.properties.id.startsWith(appKeyPrefix))
                    .map((sourceApp): IEimApp => {
                        const { properties } = sourceApp;
                        return {
                            appKey: properties.id,
                            appName: properties.name,
                            description: properties.description,
                            siteDomain,
                            siteName: siteName || siteDomain,
                            tokens,
                        };
                    });
                dispatch(createSetAppListAction(appList));
            } catch (e) {
                console.error(e);
                Toast.show({
                    text: 'ネットワークエラーが発生しました。',
                    type: 'warning',
                });
                dispatch(createSetAppListAction([]));
            }
        })();
    };
