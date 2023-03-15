import { Datex } from "unyt_core";

const example_script_info = {
    de: ["DATEX Playground", "Erstellt von", "Mehr Infos zu DATEX:", "Lade andere zu diesem Playground ein:"],
    en: ["DATEX Playground", "Created by", "More info about DATEX:", "Share this playground with others:"],
}


export function getExampleScript(lang:'de'|'en' = 'en', id?:string, endpoint = Datex.Runtime.endpoint) {
    const info = example_script_info[lang] ?? example_script_info['en'];
    return `##########################################################################

${info[0]} 

${info[1]} ${endpoint}
${info[2]} https://datex.unyt.org${id ? `\n${info[3]} https://playground.unyt.org/${id}`:''}

##########################################################################


use print from #std;

print 'Executed on (#endpoint), initiated by (#origin)';
print (@example :: 'Executed on (#endpoint), initiated by (#origin)');`
/*
# example object:
{
    "json key": "json value",
    values: ['1', 2, 3.0, 0xff, -infinity, nan, true, null, void],
    advanced: [
        <Set> [1,2,3,4],
        69kg,
        https://unyt.org,
        @example,
        'template string with evaluated expression: (5 * 10m)',
        (true or false) and (1+1 == 2)
    ]
}
*/
}