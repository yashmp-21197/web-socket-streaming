class Utils {

    static isNull = (v) => {
        return v === null;
    }

    static isNotNull = (v) => {
        return v !== null;
    }

    static isDefined = (v) => {
        return typeof v !== 'undefined';
    }

    static isUndefined = (v) => {
        return typeof v === 'undefined';
    }
}

export default Utils;