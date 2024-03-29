import Clone from 'clone';
import { Button, Card, Container, Content, Icon, Input, Item, Label, Picker, Text, Toast } from 'native-base';
import React, { Component } from 'react';
import { Alert, BackHandler, Platform, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { NavigationScreenProps } from 'react-navigation';
import { connect } from 'react-redux';
import ShortId from 'shortid';

import { FloatingButton } from '../../../components/FloatingButton/FloatingButton';
import { EIMServiceAdapter } from '../../../eim-service/EIMServiceAdapter';
import { ICombinedNavProps, IProps } from '../../../redux-helper/redux-helper';
import { asyncRemoveAccountAction, asyncSaveAccountAction } from '../../actions/AccountActions';
import navigateController from '../../actions/NavigateActions';
import { createShowWebPageAction } from '../../actions/WebSignInActions';
import { getConfig } from '../../Config';
import { IAccountManagerState } from '../../IAccountManagerState';
import RoutePageNames from '../../RoutePageNames';
import { IAccountListState } from '../../states/IAccountLisState';
import { AuthType, IAccountState } from '../../states/IAccountState';

const config = getConfig();

interface IDiffState {
    loginResultMessage: string;
    siteNameError: boolean;
    siteDomainError: boolean;
    mode: 'view' | 'edit';
    shownEditMenu: boolean;
    shownLoginDialog: boolean;
}

export interface IAccountProps extends IAccountState {
    accountListState: IAccountListState;
}
export interface ILocaleState extends IAccountState, IDiffState {
}

type localStateType = 'siteName' | 'siteDomain' | 'authType';

// interface INavParam {
//     toggleMode: () => void;
//     getMode: () => 'view' | 'edit';
// }
interface IErrors {
    siteNameErrorMessage: string;
    siteErrorMessage: string;
    hasError: boolean;
}
// eslint-disable-next-line @typescript-eslint/class-name-casing
export class _Account extends Component<ICombinedNavProps<IAccountProps>, ILocaleState> {
    public static navigationOptions = ({ navigation }: NavigationScreenProps) => {
        const { colorPalets } = config;
        return {
            headerRight: (
                <Button
                    transparent
                    onPress={navigation.getParam('remove')}
                    style={navigation.getParam('removeButtonStyle')}>
                    <Text style={{ color: '#fff', fontSize: 16, marginTop: 10 }}>削除</Text>
                </Button>
            ),
            headerStyle: {
                backgroundColor: colorPalets.$colorPrimary3,
            },
            headerTintColor: colorPalets.$invertColor,
            headerTitle: 'サイト情報',
        };
    }
    private backupState: ILocaleState | null = null;
    public constructor(props: ICombinedNavProps<IAccountProps>) {
        super(props);
        BackHandler.addEventListener('hardwareBackPress', this.backPage);
        const { cloneProp, diffState }: { cloneProp: IAccountState; diffState: IDiffState } = this.createState(props);
        this.state = Object.assign(cloneProp, diffState);
        delete (this.state as any).accountListState;
    }
    public render = () => {
        const { theme, colorPalets } = config;
        const { state } = this;
        const errorMessageStyle: TextStyle = {
            color: theme.brandDanger,
            fontSize: 12,
        };
        const style = StyleSheet.create({
            textboxStyle: {
                color: (state.mode === 'view') ? colorPalets.$frontDisabledColor : colorPalets.$frontColor,
            },
        });
        const viewingMenu =
            <FloatingButton key="edit_button" iconName="create" primaryButtonColor={theme.brandPrimary}
                onPress={this.onPressEdit} />;
        const editingMenu = [
            <FloatingButton key="save_button" iconName="md-checkmark" iconType="Ionicons"
                onPress={this.onPressSave} primaryButtonColor={theme.brandSuccess} />,
            <FloatingButton key="cancel" iconName="close" primaryButtonColor={theme.brandDanger}
                onPress={this.onPressCancelEdit} position="bottom-left" />,
        ];
        const { siteNameErrorMessage, siteErrorMessage, hasError }: IErrors = this.createErrorMessages(state);
        return (
            <Container>
                <Content>
                    <Card style={{ paddingBottom: 24 }}>
                        <Item stackedLabel>
                            <Label>サイト名称</Label>
                            <Input key="site_name" value={state.siteName} editable={state.mode === 'edit'}
                                style={style.textboxStyle}
                                onChangeText={(text) => { this.onChangeState('siteName', text); }} />
                        </Item>
                        <Text style={errorMessageStyle}>{siteNameErrorMessage}</Text>
                        <Item stackedLabel>
                            <Label>サイトドメイン</Label>
                            <Input key="site_domain" value={state.siteDomain} editable={state.mode === 'edit'}
                                style={style.textboxStyle}
                                keyboardType="url"
                                autoCapitalize="none"
                                onChangeText={(text) => { this.onChangeState('siteDomain', text); }} />
                        </Item>
                        <Text style={errorMessageStyle}>{siteErrorMessage}</Text>
                        <Item style={{ marginTop: 12, marginBottom: 12 }}>
                            <Label>認証方式</Label>
                            <Picker
                                key="auth-type"
                                mode="dropdown"
                                enabled={state.mode === 'edit'}
                                iosIcon={<Icon name="ios-arrow-down" />}
                                textStyle={style.textboxStyle as TextStyle}
                                selectedValue={state.authType}
                                style={Platform.OS === 'android' ? style.textboxStyle as TextStyle : {}}
                                onValueChange={(text) => { this.onChangeState('authType', text); }}>
                                <Picker.Item label="パスワード" value="password" />
                                <Picker.Item label="Office365認証" value="o365" />
                            </Picker>
                        </Item>
                        {this.createSignInButton(hasError)}
                    </Card>
                </Content>
                {(state.mode === 'view') ? viewingMenu : editingMenu}
            </Container>
        );
    }
    public componentDidMount = () => {
        (async () => { this.inputCheck(); })();
        this.props.navigation.setParams({ remove: this.onPressRemove });
        this.props.navigation.setParams({
            removeButtonStyle: !!this.state.id ? {} : { display: 'none' },
        });
    }
    public componentDidUpdate = (_preProp: ICombinedNavProps<IAccountState>, preState: ILocaleState) => {
        if (this.state.id !== preState.id) {
            this.props.navigation.setParams({
                removeButtonStyle: !!this.state.id ? {} : { display: 'none' },
            });
        }
    }

    private createSignInButton = (hasError: boolean) => {
        const { state } = this;
        const buttonStyle: ViewStyle = {
            marginTop: 24,
        };
        if (state.mode === 'view') {
            return <Button key="sign-in-button"
                block rounded success style={buttonStyle} disabled={hasError}
                onPress={this.onPressConnect}>
                <Text>サインイン</Text>
            </Button>;
        }
        return null;
    }
    private onPressEdit = () => {
        // キャンセルされたときのために値を保存しておく
        this.backupState = Clone(this.state);
        this.setState({ mode: 'edit' });
    }
    private onPressCancelEdit = () => {
        // 新規作成時の場合は、前の画面に戻る
        if (!this.state.id) {
            this.props.navigation.pop();
            return;
        }
        // 保持しておいた値に戻す
        this.setState(this.backupState);
        this.backupState = null;
    }
    private onPressRemove = () => {
        const me = this;
        Alert.alert(
            'アカウントの削除',
            `${this.state.siteName}を削除して良いですか?`,
            [
                {
                    style: 'default',
                    text: 'キャンセル',
                },
                {
                    onPress: () => {
                        asyncRemoveAccountAction(
                            me.state.id as string,
                            me.props.dispatch,
                            me.navPop);
                    },
                    style: 'destructive',
                    text: '削除',
                },
            ],
        );
    }
    private navPop = () => {
        this.props.navigation.pop();
    }
    private onPressConnect = async () => {
        // トークンがあればそれを検証
        const client = new EIMServiceAdapter(this.state.siteDomain);
        if (this.state.eimToken.length !== 0) {
            const tokenResult = await client.validateToken(this.state.eimToken);
            if (tokenResult) {
                await this.successConnect(this.state.eimToken);
                return;
            }
        }
        // if (this.state.authType === 'password') {
        //     this.setState({ shownLoginDialog: true });
        // } else {
        this.props.dispatch(createShowWebPageAction(this.state));
        this.props.navigation.navigate(RoutePageNames.webSignInPageName);
        // }
    }

    private changeInputState: { [key in localStateType]: (value: string) => void } = {
        siteName: (value: string) => {
            this.setState({ siteName: value });
        },
        siteDomain: (value: string) => {
            this.setState({ siteDomain: value });
        },
        authType: (value: string) => {
            this.setState({ authType: value as AuthType });
        },
    };
    private onChangeState = (key: localStateType, value: string) => {
        this.changeInputState[key](value);
        setTimeout(this.inputCheck, 100);
    }
    private onPressSave = async () => {
        if (!this.inputCheck()) {
            return;
        }
        const account = Clone(this.state) as IAccountState;
        if (!account.id) {
            account.id = ShortId();
        }
        // サイトが変更されることもあるので、トークン、ユーザー、パスワードは削除する
        account.eimToken = [];
        account.password = undefined;
        account.userId = undefined;
        // データを保存
        await asyncSaveAccountAction(account, this.props.dispatch);
        this.setState(account);
        this.setState({ mode: 'view' });
    }
    private inputCheck = (state?: ILocaleState) => {
        const targetState = state || this.state;
        let result = true;
        const changeState = {
            siteDomainError: false,
            siteNameError: false,
        };
        // サイト名 必須
        if (!targetState.siteName) {
            result = false;
            changeState.siteNameError = true;
        }
        // ドメイン名 正規表現に一致していること
        if (!/^([a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.){1,}[a-zA-Z]{2,}$/.test(targetState.siteDomain)) {
            result = false;
            changeState.siteDomainError = true;
        }
        // 指定されたドメインのみに限ること
        if (!/(ope\.azure\.ricoh-eim\.com)|(eim.ricoh.com)$/.test(targetState.siteDomain)) {
            result = false;
            changeState.siteDomainError = true;
        }
        this.setState(changeState);
        return result;
    }
    private backPage = () => {
        this.props.navigation.pop();
        return true;
    }

    private createErrorMessages(state: Readonly<ILocaleState>): IErrors {
        const hasError = state.siteDomainError || state.siteNameError;
        const siteErrorMessage: string = (this.state.siteDomainError) ? 'サイトドメインが正しくありません' : '';
        const siteNameErrorMessage: string = (this.state.siteNameError) ? 'サイト名称は必須です' : '';
        return { siteNameErrorMessage, siteErrorMessage, hasError };
    }

    private async successConnect(tokens: string[]) {
        Toast.show({ text: '認証に成功しました。', type: 'success' });
        // トークンを保存する
        const account = Clone(this.state) as IAccountState;
        account.eimToken = tokens;
        await asyncSaveAccountAction(account, this.props.dispatch);
        this.setState(account);
        this.setState({ mode: 'view' });

        // 遷移先を決定する
        await navigateController.navigateForLink(
            this.props.state.accountListState,
            {
                siteDomain: this.state.siteDomain,
                siteName: this.state.siteName,
                tokens,
            }, this.props.dispatch, this.props.navigation);
    }

    private createState(props: ICombinedNavProps<IAccountState>) {
        const cloneProp = Clone(props.state);
        const diffState: IDiffState = {
            loginResultMessage: '',
            mode: 'view',
            shownEditMenu: false,
            shownLoginDialog: false,
            siteDomainError: true,
            siteNameError: true,
        };
        if (!cloneProp.id) {
            diffState.mode = 'edit';
        }
        return { cloneProp, diffState };
    }
}

const mapStateToProps = (state: IAccountManagerState): IProps<IAccountProps> => {
    return {
        state: {
            ...state.account,
            accountListState: state.accountList
        },
    };
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const __private__ = {
    mapStateToProps,
}

export default connect(mapStateToProps)(_Account);
