import { emptySentenceJson, sentenceConllToJson, sentenceJsonToConll, emptyTokenJson, constructTextFromTreeJson, replaceArrayOfTokens, } from 'conllup/lib/conll';
/**
 * The Concrete Memento contains the infrastructure for storing the Originator's
 * state.
 */
export class SentenceMemento {
    constructor(state) {
        this.state = state;
        this.date = new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
    /**
     * The Originator uses this method when restoring its state.
     */
    getState() {
        return this.state;
    }
    /**
     * The rest of the methods are used by the Caretaker to display metadata.
     */
    getName() {
        return `${this.date}`;
        // return `${this.date} / (${this.state.substr(0, 9)}...)`;
    }
    getDate() {
        return this.date;
    }
}
/**
 * The Subject owns some important state and notifies observers when the state
 * changes.
 */
export class ReactiveSentence {
    constructor() {
        /**
         * @type {number} For the sake of simplicity, the Subject's state, essential
         * to all subscribers, is stored in this variable.
         */
        this.state = emptySentenceJson();
        /**
         * @type {Observer[]} List of subscribers. In real life, the list of
         * subscribers can be stored more comprehensively (categorized by event
         * type, etc.).
         */
        this.observers = [];
    }
    /**
     * The subscription management methods.
     */
    attach(observer, verbose = false) {
        const isExist = this.observers.includes(observer);
        if (isExist && verbose) {
            return console.log('Subject: Observer has been attached already.');
        }
        if (verbose) {
            console.log('Subject: Attached an observer.');
        }
        this.observers.push(observer);
    }
    detach(observer, verbose = false) {
        const observerIndex = this.observers.indexOf(observer);
        if (observerIndex === -1 && verbose) {
            return console.log('Subject: Nonexistent observer.');
        }
        if (verbose) {
            console.log('Subject: Detached an observer.');
        }
        this.observers.splice(observerIndex, 1);
    }
    /**
     * Trigger an update in each subscriber.
     */
    notify(verbose = false) {
        if (verbose) {
            console.log("Subject: The reactiveSentence object changed. Notifying all of the observers by running their 'update()' methods.");
        }
        for (const observer of this.observers) {
            observer.update(this);
        }
    }
    /**
     * Originator implementation
     */
    save() {
        return new SentenceMemento(JSON.stringify(this.state));
    }
    /**
     * Restores the Originator's state from a memento object.
     */
    restore(memento) {
        this.state = JSON.parse(memento.getState());
        this.notify();
    }
    fromSentenceConll(sentenceConll) {
        this.state = sentenceConllToJson(sentenceConll);
        this.notify();
    }
    /**
     * Import sentence from object of SentenceJson interface
     * @param sentenceJson
     */
    fromSentenceJson(sentenceJson) {
        this.state = JSON.parse(JSON.stringify(sentenceJson));
        this.notify();
    }
    updateToken(tokenJson) {
        tokenJson.ID = tokenJson.ID.toString();
        if (tokenJson.ID.indexOf('-') > -1) {
            // is group token
            Object.assign(this.state.treeJson.groupsJson[tokenJson.ID], tokenJson);
        }
        else if (tokenJson.ID.indexOf('.') > -1) {
            // is enhanced token
            Object.assign(this.state.treeJson.enhancedNodesJson[tokenJson.ID], tokenJson);
        }
        else {
            // is normal token
            Object.assign(this.state.treeJson.nodesJson[tokenJson.ID], tokenJson);
        }
        this.notify();
    }
    updateTree(treeJson) {
        this.state.treeJson = JSON.parse(JSON.stringify(treeJson));
        this.notify();
    }
    updateSentence(sentenceJson) {
        this.state = JSON.parse(JSON.stringify(sentenceJson));
        this.notify();
    }
    toggleBoolFeat(tokenID, feat) {
        let token = this.state.treeJson.nodesJson[tokenID];
        let active = true;
        if (feat in token.MISC) {
            delete token.MISC[feat];
            active = false;
        }
        else {
            token.MISC[feat] = "Yes";
        }
        this.updateToken(token);
        // so that the application can give visual feedback without performing a similar check
        return active;
    }
    removeToken(tokenID) {
        const newTree = replaceArrayOfTokens(this.state.treeJson, [parseInt(tokenID, 10)], []);
        this.updateTree(newTree);
    }
    addEmptyTokenBefore(tokenID) {
        const succToken = this.state.treeJson.nodesJson[tokenID];
        const tokenIntD = parseInt(tokenID, 10);
        const newTree = replaceArrayOfTokens(this.state.treeJson, [tokenIntD], ["_", this.state.treeJson.nodesJson[tokenID].FORM], true);
        const oldTokenID = (tokenIntD + 1).toString();
        // rollback lemma of succ token and reset most fields of the new one
        // (this is necessary because "adding" is designed for token splitting)
        newTree.nodesJson[oldTokenID].LEMMA = succToken.LEMMA;
        newTree.nodesJson[tokenID].UPOS = "_";
        newTree.nodesJson[tokenID].XPOS = "_";
        newTree.nodesJson[tokenID].FEATS = {};
        newTree.nodesJson[tokenID].HEAD = -1;
        newTree.nodesJson[tokenID].DEPREL = "_";
        newTree.nodesJson[tokenID].DEPS = {};
        newTree.nodesJson[tokenID].MISC = {};
        this.updateTree(newTree);
    }
    addEmptyTokenAfter(tokenID) {
        const prevToken = this.state.treeJson.nodesJson[tokenID];
        const tokenIntD = parseInt(tokenID, 10);
        const newTree = replaceArrayOfTokens(this.state.treeJson, [tokenIntD], [this.state.treeJson.nodesJson[tokenID].FORM, "_"], true);
        const newTokenID = (tokenIntD + 1).toString();
        // rollback prev token and reset most fields of the new one
        // (this is necessary because "adding" is designed for token splitting)
        newTree.nodesJson[tokenID] = prevToken;
        newTree.nodesJson[newTokenID].LEMMA = "_";
        newTree.nodesJson[newTokenID].UPOS = "_";
        newTree.nodesJson[newTokenID].XPOS = "_";
        newTree.nodesJson[newTokenID].FEATS = {};
        newTree.nodesJson[newTokenID].HEAD = -1;
        newTree.nodesJson[newTokenID].DEPREL = "_";
        newTree.nodesJson[newTokenID].DEPS = {};
        newTree.nodesJson[newTokenID].MISC = {};
        this.updateTree(newTree);
    }
    addEmptyToken() {
        const newToken = emptyTokenJson();
        let idLastToken = '1';
        for (const tokenJson of Object.values(this.state.treeJson.nodesJson)) {
            idLastToken = (parseInt(tokenJson.ID, 10) + 1).toString();
        }
        newToken.ID = idLastToken;
        newToken.FORM = '_';
        this.state.treeJson.nodesJson[newToken.ID] = newToken;
        this.state.treeJson = JSON.parse(JSON.stringify(this.state.treeJson));
        this.notify();
    }
    exportConll() {
        return sentenceJsonToConll({
            treeJson: this.state.treeJson,
            metaJson: this.state.metaJson,
        });
    }
    getSentenceText() {
        return constructTextFromTreeJson(this.state.treeJson);
    }
    getUndescoredText() {
        const tokensForms = [];
        for (const tokenId in this.state.treeJson.nodesJson) {
            if (this.state.treeJson.nodesJson[tokenId]) {
                const token = this.state.treeJson.nodesJson[tokenId];
                tokensForms.push(token.FORM);
            }
        }
        const underscoredText = tokensForms.join('_');
        return underscoredText;
    }
    getAllFeaturesSet() {
        const allFeaturesSet = ['FORM', 'LEMMA', 'UPOS', 'XPOS'];
        for (const tokenId in this.state.treeJson.nodesJson) {
            if (this.state.treeJson.nodesJson[tokenId]) {
                const features = this.state.treeJson.nodesJson[tokenId].FEATS;
                const miscs = this.state.treeJson.nodesJson[tokenId].MISC;
                for (const feat in features) {
                    if (!allFeaturesSet.includes(`FEATS.${feat}`)) {
                        allFeaturesSet.push(`FEATS.${feat}`);
                    }
                }
                for (const misc in miscs) {
                    if (!allFeaturesSet.includes(`MISC.${misc}`)) {
                        allFeaturesSet.push(`MISC.${misc}`);
                    }
                }
            }
        }
        return allFeaturesSet;
    }
    exportConllWithModifiedMeta(newMetaJson) {
        for (const [metaName, metaValue] of Object.entries(this.state.metaJson)) {
            if (!Object.keys(newMetaJson).includes(metaName)) {
                newMetaJson[metaName] = metaValue;
            }
        }
        const sentenceJsonToExport = {
            treeJson: this.state.treeJson,
            metaJson: newMetaJson,
        };
        return sentenceJsonToConll(sentenceJsonToExport);
    }
}
export class SentenceCaretaker {
    constructor(originator) {
        this.mementos = [];
        this._currentStateIndex = -1;
        this.originator = originator;
    }
    backup() {
        this.mementos = this.mementos.slice(0, this._currentStateIndex + 1);
        this.mementos.push(this.originator.save());
        this._currentStateIndex++;
    }
    canUndo() {
        return this._currentStateIndex !== 0;
    }
    canRedo() {
        return this._currentStateIndex + 1 !== this.mementos.length;
    }
    undo(verbose = false) {
        if (!this.canUndo() && verbose) {
            console.log('caretaker: the caretaker mementos was empty');
            return;
        }
        this._currentStateIndex--;
        const memento = this.mementos[this._currentStateIndex];
        if (memento) {
            this.originator.restore(memento);
        }
    }
    redo(verbose = false) {
        if (!this.canRedo() && verbose) {
            console.log("caretaker: can't redo, you are already at the end of your mementos");
            return;
        }
        this._currentStateIndex++;
        const memento = this.mementos[this._currentStateIndex];
        if (memento) {
            this.originator.restore(memento);
        }
    }
    showHistory() {
        for (const memento of this.mementos) {
            console.log(memento.getName(), memento.getState());
        }
    }
    get currentStateIndex() {
        return this._currentStateIndex;
    }
}
