export function pluralize(singular, count) {
    const remainder100 = count % 100;
    const remainder10 = count % 10;
    let suffix = '';

    if (remainder100 >= 11 && remainder100 <= 14) {
        suffix = 'ов';
    } else {
        switch (remainder10) {
            case 1:
                suffix = '';
                break;
            case 2:
            case 3:
            case 4:
                suffix = 'а';
                break;
            default:
                suffix = 'ов';
        }
    }

    return singular + suffix;
}