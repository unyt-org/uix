/**
 ╔══════════════════════════════════════════════════════════════════════════════════════╗
 ║  Database - UIX Standard Lib                                                         ║
 ╠══════════════════════════════════════════════════════════════════════════════════════╣
 ║  database file tree + database table viewer/editor (connect to databases via mentos) ║
 ║  Visit https://docs.unyt.cc/unyt for more information                                ║
 ╠═════════════════════════════════════════╦════════════════════════════════════════════╣
 ║  © 2020 Jonas & Benedikt Strehle        ║                                            ║
 ╚═════════════════════════════════════════╩════════════════════════════════════════════╝
 */

// ---
import { Datex, f, decimal, pointer, property, props, remote, scope, template, timeout, text } from "unyt_core";

import { UIX } from "../../uix.ts";

import { Logger } from "unyt_core/utils/logger.ts";
import MonacoHandler, { MonacoTab } from "../code_editor/monaco.ts";
import { I, S, S_HTML, SVAL } from "../../uix_short.ts";
import { Resource, ResourceManger, resource_meta } from "../../uix_all.ts";

const logger = new Logger("database")


// OPTION TYPES

interface DB_OPTIONS {
    table_name?: string,
    db?: string,
    hostname?: string,
    port?: number,
    username?: string,
    password?: string,
    endpoint?: Datex.Endpoint
}

export interface DB_TABLE_VIEW_OPTIONS extends UIX.Components.Base.Options, DB_OPTIONS {
    where?: string
}
export interface DB_QUERY_VIEW_OPTIONS extends UIX.Components.Base.Options {
    where?: string
}

export interface DB_VIEW_OPTIONS extends UIX.Components.GridGroup.Options, DB_OPTIONS {}

export interface DB_TREE_OPTIONS extends UIX.Components.Tree.Options, DB_OPTIONS {}
export interface DB_STRUCTURE_OPTIONS extends UIX.Components.NodeGroup.Options, DB_OPTIONS {}


UIX.Utils.registerEntryType("database", "#ef6f47", I`fa-database`);
UIX.Utils.registerEntryType("table", "var(--text_color)", I`fa-table`);
UIX.Utils.registerEntryType("column", "var(--text_color)", '●');
UIX.Utils.registerEntryType("primary_column", "var(--light_blue)", '●');
UIX.Utils.registerEntryType("invisible_column", "var(--text_color_light)", '●');

UIX.Res.addStrings({
    en: {
        no_tables: 'No table selected',
        rows: 'Rows',
        export: 'Export table',
        import_csv: 'Import CSV',
        delete_entry: 'Delete entry',
        delete_entry_confirm: 'Do you really want to delete this entry?',
        all: 'All',
        exporting: 'Exporting table to XLS',
        export_error: 'Could not export the table to XLS',
        delete_error: 'Could not delete the entry',
        cancel: 'Cancel',
        delete: 'Delete',
        error: 'Error',
        drop_database: "Drop Database",
        drop_table: "Drop Table",
        rename_database: "Rename Database",
        rename_table: "Rename Table",
        table: "table",
        database: "database",
    },
    de: {
        no_tables: 'Keine Tabelle ausgewählt',
        rows: 'Einträge',
        export: 'Tabelle exportieren',
        import_csv: 'CSV importieren',
        delete_entry: 'Eintrag löschen',
        delete_entry_confirm: 'Wollen Sie diesen Eintrag wirklich löschen?',
        delete_error: 'Eintrag konnte nicht gelöscht werden',
        all: 'Alle',
        exporting: 'Tabelle wird als XLS exportiert',
        export_error: 'Tabelle konnte nicht exportiert werden',
        cancel: 'Abbrechen',
        delete: 'Löschen',
        error: 'Fehler',
        drop_database: "Datenbank löschen",
        drop_table: "Tabelle löschen",
        rename_database: "Datenbank umbenennen",
        rename_table: "Tabelle umbenennen",
        table: "Tabelle",
        database: "Datenbank",
    },
})

const QUERY = {
    GET_TABLE_INFO: "SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA=?;",
    GET_COLUMN_INFO: "SELECT * FROM information_schema.columns where TABLE_SCHEMA = ? and TABLE_NAME = ?;",
    GET_TABLE_FIELDS: "SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ? ORDER BY ORDINAL_POSITION;",
    GET_TABLE_FIELD_NAMES: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ? ORDER BY ORDINAL_POSITION;",
    GET_DB_FOREIGN_KEYS: "SELECT TABLE_NAME,COLUMN_NAME,CONSTRAINT_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA = ?;"
}



type connection_options = { hostname: string, username: string, password: string, db: string, port?:number}
type query_result = {
    rows: object[],
    fields: mysql_column[],
    options: {sorted_by_column?:string, desc?:boolean};
}

type mysql_data_type = 'int'|'bigint'|'smallint'|'mediumint'|'tinyint'|'tiny'|'long'|'year'|
                       'float'|'double'|'decimal'|
                       'timestamp'|'date'|'datetime'|
                       'time'|'varchar'|'char'|'text'|'tinytext'|'mediumtext'|'longtext'|'enum'|
                       'set'|'geometry'|
                       'tinyblob'|'blob'|'mediumblob'|'longblob'|'binary'|'varbinary'|'bit'|
                       'boolean'|'json';
type mysql_data_type_caps = `${Uppercase<mysql_data_type>}`


type mysql_column = {
    TABLE_CATALOG: string,
    TABLE_SCHEMA: string,
    TABLE_NAME: string,
    COLUMN_NAME: string,
    ORDINAL_POSITION: bigint,
    COLUMN_DEFAULT: any,
    IS_NULLABLE: 'NO'|'YES',
    DATA_TYPE: mysql_data_type,
    CHARACTER_MAXIMUM_LENGTH: bigint,
    CHARACTER_OCTET_LENGTH: bigint,
    NUMERIC_PRECISION: bigint,
    NUMERIC_SCALE: bigint,
    DATETIME_PRECISION: bigint,
    CHARACTER_SET_NAME: string,
    COLLATION_NAME: string,
    COLUMN_TYPE: mysql_data_type|`${mysql_data_type}(${number})`,
    COLUMN_KEY: 'PRI'|'',
    EXTRA: string,
    PRIVILEGES: string,
    COLUMN_COMMENT: string,
    GENERATION_EXPRESSION: string,
    SRS_ID: any
}

// new sql connection class
@scope("sql") abstract class _SQL {
    @remote static connect(connection_options: connection_options): Promise<SQLConnection> {return null}
}
const SQL = Datex.datex_advanced(_SQL);

// deno-lint-ignore no-unused-vars
@template class SQLConnection {
    @timeout(60_000) @property query!: (query:string, query_params?:any[]) => Promise<any[]>
}


/** complete db viewer */
@UIX.Group("MySQL")
@UIX.Component<DB_VIEW_OPTIONS>({
    icon: 'fa-database',
    columns:[0.2, 0.8], 
    rows:[1],
    sealed: false
})
export class DBView <O extends DB_VIEW_OPTIONS = DB_VIEW_OPTIONS> extends UIX.Components.GridGroup<O> {

    tab_group:UIX.Components.TabGroup
    tree: DBTree

    onAssemble() {
        const credentials = {
            hostname  : this.options.hostname,
            username  : this.options.username,
            password  : this.options.password,
            port      : this.options.port,
            db        : this.options.db,
            table_name: this.options.table_name,
        }
        this.tab_group = new UIX.Components.TabGroup({id:'tab_group', add_btn:false, ...credentials, no_elements_string: "no_tables", enable_drop:false}, {gx: 1});
        const tree_options = {id:'tree', ...credentials, enable_drop:false, endpoint:this.options.endpoint, collector: this.tab_group};
        if (this.options.hasOwnProperty("title")) tree_options.title = this.options.title;
        this.tree = new DBTree(tree_options, {gx:0})
        this.addChild(this.tree)
        this.addChild(this.tab_group)
    }

    onReady(){
        this.tree = <DBTree> this.getElementByIdentifier('tree');
        this.tab_group = <UIX.Components.TabGroup> this.getElementByIdentifier('tab_group');
                
        this.title = this.tree.options.db; // use title from tree view
    }

}


class DBResourceManager extends ResourceManger {
    
    sql_connections_per_db: Map<Resource, SQLConnection> = new Map();

    isDirectory(resource: Resource): Promise<boolean> {
        return null;
    }

    addResource(resource: Resource, value: any): Promise<void> {
        throw new Error("Method not implemented.");
    }
    addResourceDirectory(resource: Resource): Promise<void> {
        throw new Error("Method not implemented.");
    }
    getResourceValue(resource: Resource): Promise<any> {
        return null;
    }
    setResourceValue(resource: Resource, value: any): Promise<void> {
        throw new Error("Method not implemented.");
    }
    getMetaData(resource: Resource): Promise<object> {
        return null
    }

    async getChildren(resource: Resource, update_meta: boolean):Promise<(string | [string, resource_meta])[]> {
        // get tables
        if (resource.meta.type == "database") {
            let sql = this.sql_connections_per_db.get(resource);

            let tables = await sql.query(QUERY.GET_TABLE_INFO, [resource.name]);
            let children = []
            for (let table of tables) {
                children.push([resource.default_path+table.TABLE_NAME+"/", {type:"table", open: true}])
            }
            return children;
        }
        // get columns
        if (resource.meta.type == "table") {
            let root = resource.parent
            let sql = this.sql_connections_per_db.get(root);

            let columns:mysql_column[] = await sql.query(QUERY.GET_COLUMN_INFO, [root.name, resource.name]);
            let children:[string, resource_meta][] = []
          
            for (let column of columns) {
                const is_primary_column = column.COLUMN_KEY=="PRI";
                const is_invisible_column = column.EXTRA == "INVISIBLE"

                children.push([
                    resource.default_path+column.COLUMN_NAME, 
                    {
                        type: is_invisible_column ? "invisible_column" : (is_primary_column ? "primary_column" : "column"), 
                        html: `<span style='color:${is_invisible_column ? 'var(--text_color_light)':(is_primary_column ? 'var(--light_blue)':'var(--text_color)')}'>${column.COLUMN_NAME}</span><span style='color:var(--text_color_light);margin-left:10px;'>${column.COLUMN_TYPE}</span>`
                    }])
            }
            
            return children;
        }

        else return []
    }
    renameResource(resource: Resource, new_name: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    deleteResource(resource: Resource): Promise<void> {
        throw new Error("Method not implemented.");
    }
    moveResource(resource: Resource, new_path: string): Promise<void> {
        throw new Error("Method not implemented.");
    }

}

const db_resource_manager = new DBResourceManager("db://")


@UIX.Group("MySQL")
@UIX.Component<DB_TREE_OPTIONS>({
    icon: 'fa-list',
    vertical_align: UIX.Types.VERTICAL_ALIGN.TOP,
    horizontal_align: UIX.Types.HORIZONTAL_ALIGN.LEFT,
    search: false
})
export class DBTree<O extends DB_TREE_OPTIONS = DB_TREE_OPTIONS> extends UIX.Components.Tree<O> {
    
    sql: SQLConnection;

    /** divides an entry into an array of single elements corresponding to the entries (tables) */
    protected override async handleCreateSeparateElementsFromEntry(resource: Resource): Promise<UIX.Components.Base[]> {
        const options = {
            db: resource.parent.name,
            table_name: resource.name,
            hostname: this.options.hostname,
            username: this.options.username,
            password: this.options.password,
            endpoint:this.options.endpoint
        }

        if (resource.meta.type == "table") {
            return [new DBExtendedTableView<DB_TABLE_VIEW_OPTIONS>(options)];
        }
        else if (resource.meta.type == "database") {
            const els = [];
            for (const table of await resource.children) {
                els.push(new DBExtendedTableView<DB_TABLE_VIEW_OPTIONS>({
                    db: table.parent.name,
                    table_name: table.name,
                    hostname: this.options.hostname,
                    username: this.options.username,
                    password: this.options.password,
                    endpoint: this.options.endpoint
                }));
            }
            return els;
        }
        return [];
    }

    protected override async handleCreateElementFromResource(resource: Resource): Promise<UIX.Components.Base> {

        const tables = await this.handleCreateSeparateElementsFromEntry(resource);

        if (resource.meta.type == "table") return tables[0]

        else if (resource.meta.type == "database") {
            const group = new UIX.Components.TabGroup({title:resource.name, title_color:UIX.Utils.getResourceColor(resource), icon:UIX.Utils.getResourceIcon(resource)});
            for (const table of tables) await group.addChild(table);
            return group;
        }

        return null;
    }

    override async onCreate() {

        if (!this.options.hasOwnProperty("title")) this.title = this.options.db;

        const sql = await SQL.to(this.options.endpoint??f('@+CODE')).connect({db:this.options.db!, hostname:this.options.hostname!, username:this.options.username!, password:this.options.password!, port:this.options.port});
        this.root_resource = Resource.get(`db://${this.options.hostname}${this.options.port?':'+this.options.port:''}/${this.options.db}/`, {type: "database", expanded: true})

        // add sql connection to resource manager for loading db + tables when required
        db_resource_manager.sql_connections_per_db.set(this.root_resource, sql);
    
        await super.onCreate();
    }

    protected override createContextMenuBody(resource: Resource) {
        if (resource.meta.type=="database") return {
            drop_database: {
                text: S`drop_database`, shortcut: "delete",
                handler: ()=>this.onEntryDelete(resource)
            },
            rename_database: {
                text: S`rename_database`, shortcut: "rename",
                handler:  ()=>this.handleEntryEdit(resource)
            }
        }
        else if (resource.meta.type=="table") return {
            drop_table: {
                text: S`drop_table`, shortcut: "delete",
                handler: ()=>this.onEntryDelete(resource)
            },
            rename_table: {
                text: S`rename_table`, shortcut: "rename",
                handler:  ()=>this.handleEntryEdit(resource)
            }
        }
    }


    protected override async onEntryDelete(resource:Resource) {
        UIX.Actions.dialog(S_HTML('delete_confirm', resource.meta.type=="table" ? SVAL`table` : SVAL`database`), `<span style="color:${UIX.Utils.getResourceColor(resource)}">${UIX.Utils.getResourceIcon(resource)} ${resource.name}</span>`, [
            {text:"Cancel"},
            {text:"Delete", color:"#ac1928", onClick:async ()=>{
                    await resource.delete();
                    this.collapse(resource);
                }}
        ])
    }


}



@UIX.Group("MySQL")
@UIX.Component<DB_QUERY_VIEW_OPTIONS>({icon:'fa-table', overflow:true, vertical_align:UIX.Types.VERTICAL_ALIGN.TOP, horizontal_align:UIX.Types.HORIZONTAL_ALIGN.LEFT, padding:5})
export class DBQueryView<O extends DB_QUERY_VIEW_OPTIONS = DB_QUERY_VIEW_OPTIONS> extends UIX.Components.Base<O> {

    monaco:MonacoTab
    where_edit: HTMLDivElement

    row_ranges = []
    row_count = 0;

    public ROW_LIMIT = 50;

    where_changed = true; // indicate that the where clause was updated or first loading the table


    async updateQuery(){
        let where = this.monaco.getContent();
        this.where_changed = true;
        this.sendMessageUp("query", {where:where, row_offset:0, row_limit:this.ROW_LIMIT})
    }

    protected onInit() {
        this.addStyleSheet(MonacoHandler.stylesheet);
    }

    async onCreate(){

        this.content.style.display = 'flex';
        this.content.style.flexDirection = 'row';
        this.content.style.alignItems = 'center';

        let where = UIX.Utils.setCSS(document.createElement("div"), {color:'var(--text_color_light)', 'font-size': '18px', 'margin-right': '8px'})
        where.innerText = "WHERE";
        this.where_edit = UIX.Utils.setCSS(document.createElement("div"), {'padding-top': '2px', height: '24px', width:'300px', flex:1});
        this.where_edit.classList.add('single-line-editor')

        let update_btn = new UIX.Elements.Button({content:I`fa-sync-alt`, onClick:()=>this.updateQuery()})
        update_btn.style.marginRight = "10px";

        let delete_btn = new UIX.Elements.Button({content:I`fa-minus`, onClick:()=>this.sendMessageUp("delete")})
        delete_btn.style.marginLeft = "10px";

        let export_btn =  new UIX.Elements.Button({content: await text `${I`fa-file-export`} ${S`export`}`, onClick:()=>this.sendMessageUp("export")})
        export_btn.style.marginLeft = "10px";

        let import_btn = new UIX.Elements.Button({content: await text `${I`fa-file-import`} ${S`import_csv`}`, onClick:()=>this.sendMessageUp("import")});
        import_btn.style.marginLeft = "10px";
        
        const options = pointer(["----------"]);
        
        let selected_index = decimal();

        let row_select = new UIX.Elements.DropdownMenu(options, { title: S('rows'), selected_index:selected_index, onChange: (index)=>{
            //console.log("index", index, this.row_ranges)
            this.sendMessageUp("query", this.row_ranges[index])
        }});
        row_select.style.marginRight = "10px"
        

        this.content.append(update_btn);
        this.content.append(row_select);

        this.content.append(where);
        this.content.append(this.where_edit);

        this.content.append(delete_btn);
        this.content.append(import_btn);
        this.content.append(export_btn);
        await MonacoHandler.init();
        this.monaco = await MonacoHandler.createTab(this.where_edit, null, true);
        await this.monaco.loadText(this.options.where || "", "mysql", {
            wordWrap: 'off',
            lineNumbers: 'off',
            lineNumbersMinChars: 0,
            overviewRulerLanes: 0,
            overviewRulerBorder: false,
            lineDecorationsWidth: 0,
            hideCursorInOverviewRuler: true,
            folding: false,
            scrollBeyondLastColumn: 0,
            mouseWheelZoom: false,
            padding: {bottom:0, top:0},
            scrollbar: {horizontal: 'hidden', vertical: 'hidden'},
            find: {addExtraSpaceOnTop: false, autoFindInSelection: 'never', seedSearchStringFromSelection: false}
        }, "sql");

        this.monaco.editor.onKeyDown(e => {
            if (e.keyCode == MonacoHandler.monaco.KeyCode.Enter) {
                // only prevent enter when the suggest model is not active
                if (this.monaco.editor.getContribution('editor.contrib.suggestController').model.state == 0) {
                    e.preventDefault();
                    this.updateQuery();
                }
            }
        });
        this.monaco.editor.onDidPaste(e => {
           if (e.range.endLineNumber > 1) {
               let newContent = "";
               let lineCount = this.monaco.editor.getLineCount();
               for (let i = 0; i < lineCount; i++) {
                   newContent += this.monaco.editor.getLineContent(i + 1);
               }
               this.monaco.editor.setValue(newContent);
           }
        });

        this.monaco.editor.onDidChangeModelContent(()=>{
            this.options.where = this.monaco.getContent(); // save current WHERE ...
        })

        where.addEventListener("click", ()=>this.monaco.focus());

        if (this.options.where) this.updateQuery();


        // update row count
        this.onMessage((type, row_count) => {
            this.row_ranges = []

            // first reset options
            options.splice(0, options.length);

            let interval = this.ROW_LIMIT;
            let index = 0;
            let c = 0;
            while (index < row_count) {
                let next = Math.min(index+interval, row_count);
                options[c] = (index+1) + (next==index+1 ? "" : "-" + next);
                this.row_ranges[c] = {row_offset:index, row_limit:interval}
                index += interval;
                if (c++ > 10) break; // max number of entries
            }

            if (options.length > 1) {
                options[c] = S('all') + ' ('+row_count+')';
                this.row_ranges[c] = {row_offset:0, row_limit:row_count+1}
            }

            // no entries
            if (options.length == 0) {
                options[0] = "----------";
            }

            if (this.where_changed) { // selected option has to be reset
                this.where_changed = false;
                selected_index.val = 0;
            }
            this.row_count = row_count
        }, "row_count")

    }

}

type pk_unique = [string, any][];

@UIX.Group("MySQL")
@UIX.Component<DB_TABLE_VIEW_OPTIONS>({icon:'fa-table', vertical_align:UIX.Types.VERTICAL_ALIGN.TOP, border:false, bg_color:null})
export class DBTableView<O extends DB_TABLE_VIEW_OPTIONS = DB_TABLE_VIEW_OPTIONS> extends UIX.Components.Base<O> {

    private updated_columns = new Map<pk_unique, {[set:string]:any}>();
    private insert_rows:unknown[][] = []
    private column_names:string[] = []
    private column_info:{[name:string]:mysql_column} = {};

    private selected_row_pk_unique: pk_unique;
    private selected_row: HTMLTableRowElement;

    private order_by_column:string;
    private desc: boolean;

    declare protected table: HTMLTableElement;
    declare protected body: HTMLElement

    protected sql: SQLConnection

    public row_limit = 50
    private row_offset = 0

    private row_count = 0;

    private get where(){
        return this.options.where
    }

    private set where(where:string){
        this.options.where = where;
    }


    // @implement: return additional context menu items
    protected createContextMenu():{[id:string]:UIX.Types.context_menu_item} {
        return {
            save_changes: {
                text: S`save_changes`,
                shortcut: 'save',
                handler: ()=>{
                    this.insertRows();
                    this.saveChanges();
                },
                disabled:()=>!this.updated_columns || (this.updated_columns.size ? false : true)
            }
        }
    }


    // // @implement
    // onInit() {
    //     this.id = this.options.database + "/" + this.options.table_name;
    // }

    async onCreate() {

        await this.connectToDatabase();

        this.onMessage((type, data)=>{
            if (!data) {
                logger.error("no query data");
                return;
            }
            if ('where' in data) this.where = data.where;
            if ('row_limit' in data) this.row_limit = data.row_limit;
            if ('row_offset' in data) this.row_offset = data.row_offset;
            this.tableQuery();
        }, "query");

        this.onMessage(()=>{this.exportTable()}, "export");
        this.onMessage(()=>{this.importTableEntries()}, "import");

        this.onMessage(()=>{
            if (!this.selected_row_pk_unique) {
                UIX.Actions.notification(S('error'), S('delete_error'));
                return;
            }

            this.deleteRow()

        }, "delete");


        //this.id = "/otto/appl_game_cool/.db/" + this.options.host + ":" + this.options.database + "/" + this.options.table_name;

        this.title = this.options.table_name;
        this.tableQuery();
    }
    
    private async connectToDatabase(){
        this.sql = await SQL.to(this.options.endpoint??f('@+CODE')).connect({db:this.options.db!, hostname:this.options.hostname!, username:this.options.username!, password:this.options.password!, port:this.options.port});
    }

    private escapeHTML(unsafe:any) {
        if (typeof unsafe != "string") unsafe = unsafe.toString()

        return unsafe.replace(/[&<"']/g, function(m) {
          switch (m) {
            case '&':
              return '&amp;';
            case '<':
              return '&lt;';
            case '"':
              return '&quot;';
            default:
              return '&#039;';
          }
        });
    }

    // import table entries from CSV file
    private async importTableEntries(){
        // @ts-ignore
        const [fileHandle] = await window.showOpenFilePicker({excludeAcceptAllOption:true, 
            types: [{description: 'CSV Documents',accept: { 'text/csv': ['.txt', '.csv']}}]
        });
        const csvFile:File = await fileHandle.getFile();
        const csvRows = (await csvFile.text()).replaceAll("\r","").split("\n");
        let columns:string[];

        const options = props({
            seperator:";",
            has_header: true
        });
        
        await UIX.Actions.dialog(`Import table data from "${csvFile.name}"`, "", [{text:"Cancel"}, {text:"Import",color:'var(--light_blue)', dark_text:true}]);

        if (options.has_header) {
            columns = csvRows.splice(0,1)[0].split(options.seperator.val);
        }
        else {
            const numCols = csvRows[0].split(options.seperator.val).length;
            columns = this.column_names.slice(0, numCols);
        }
        const columns_string = `(${columns.map(c=>`\`${c}\``).join(',')})`

        const insert_rows = [];


        for (const row_string of csvRows) {
            const row = row_string.split(options.seperator.val);
            let c = 0;

            const insert_values:unknown[] = [];
            insert_rows.push(insert_values);

            // iterate over columns
            for (const column of columns) {
                const type = this.column_info[column]?.DATA_TYPE;
                if (!type) {
                    UIX.Actions.notification("Import Error", "Invalid column '"+column+"'");
                    throw Error("Invalid column '"+column+"'");
                }
                switch (type) {
                    // string
                    case "varchar":
                    case "text":
                    case "time":
                    case "char":
                    case "tinytext":
                    case "mediumtext":
                    case "longtext":
                    case "enum":
                        insert_values.push(row[c])
                        break;
                    // int
                    case "bigint":
                    case "int":
                    case "smallint":
                    case "mediumint":
                    case "tinyint":
                    case "tiny":
                    case "long":
                    case "year":
                        insert_values.push(BigInt(row[c]))
                        break;
                    // float
                    case "float":
                    case "double":
                    case "decimal":
                        insert_values.push(Number(row[c]))
                        break;
                    // time
                    case "timestamp":
                    case "date":
                    case "datetime":
                        insert_values.push(new Date(row[c]))
                        break;
                    // boolean
                    case "boolean":
                        if (row[c] == "true") insert_values.push(true);
                        else if (row[c] == "false") insert_values.push(false);
                        else insert_values.push(!!Number(row[c]));
                        break;
                    // json
                    case "json":
                        insert_values.push(JSON.parse(row[c]));
                        break;
                    default:
                        UIX.Actions.notification("Import Error", "Cannot create MYSQL value of type '"+type+"'");
                        throw Error("Cannot create MYSQL value of type '"+type+"'");
                }
                c++;
            }
        }

        // add all rows with one INSERT query
        const query_string = `INSERT INTO \`${this.options.db}\`.\`${this.options.table_name}\` ${columns_string} VALUES ${Array(csvRows.length).fill('(?)').join(',')};`
        
        console.log(options);

        console.log(query_string, insert_rows)
        await this.sql.query(query_string, insert_rows)
        this.tableQuery();
    }


    // export table to xls file
    private async exportTable(){
        let d;
        try {
            console.log("exporting table as xls");
            let body = document.createElement("div");
            UIX.Utils.setCSS(body, {width:'100%',display:'flex', height:'100px', 'justify-content':'center', 'align-items':'center'})
            body.append(UIX.Utils.createHTMLElement('<div class="loading-circle"></div>'));

            d = UIX.Actions.dialog(S('exporting'), body, null, false);

            let xls = `<html xmlns:x="urn:schemas-microsoft-com:office:excel">
            <head>
                <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
                <xml>
                    <x:ExcelWorkbook>
                        <x:ExcelWorksheets>
                            <x:ExcelWorksheet>
                                <x:Name>${this.options.table_name}</x:Name>
                                <x:WorksheetOptions>
                                    <x:DisplayGridlines/>
                                </x:WorksheetOptions>
                            </x:ExcelWorksheet>
                        </x:ExcelWorksheets>
                    </x:ExcelWorkbook>
                </xml>
            </head>
            <body><table>`

            let field_names = [];

            let fields = await this.sql.query(QUERY.GET_TABLE_FIELD_NAMES, [this.options.table_name, this.options.db]);
            for (let field of fields) {
                field_names.push(field.COLUMN_NAME);
            }

            let rows   = await this.sql.query(`SELECT * FROM \`${this.options.db}\`.\`${this.options.table_name}\` ${this.where? "WHERE " + this.
            where : ''} ${this.order_by_column ? 
                "ORDER BY `" + this.order_by_column + "` " + (this.desc ? "DESC" : "ASC") : ""}`)


            // add header
            xls += "<tr>"
            for (const name of field_names) {
                xls += "<th><b>" +this.escapeHTML(name??"") + "</b></th>";
            }
            xls += "</tr>";

            for (const row of rows) {
                xls += "<tr>"
                for (const f of field_names) {
                    let row_string = row[f];
                    if (row[f] instanceof Date) row_string = (<Date>row[f]).toUTCString();
                    xls += "<td>" + this.escapeHTML(row_string??"") + "</td>";
                }
                xls += "</tr>"
            }
            xls += "</table></body></html>"

            UIX.Files.downloadFile(xls, "text/xml", this.options.table_name + ".xls");

            d.cancel()

        } catch(e) {
            logger.error("export error", e)
            d.cancel()
            UIX.Actions.notification(S('error'), S('export_error'));
        }

    }

    private async tableQuery() {
        if (!this.sql) await this.connectToDatabase();

        let fields: any[], rows: any[], row_count: number
        let field_names = [];
        try {
            fields = await this.sql.query(QUERY.GET_TABLE_FIELDS, [this.options.table_name, this.options.db]);
            for (let field of fields) field_names.push('`'+field.COLUMN_NAME+'`');
            rows   = await this.sql.query(`SELECT ${field_names.join(",")} FROM \`${this.options.db}\`.\`${this.options.table_name}\` ${this.where? "WHERE " + this.where : ''} ${this.order_by_column ? 
                "ORDER BY `" + this.order_by_column + "` " + (this.desc ? "DESC" : "ASC") : ""} LIMIT ${Number(this.row_limit)} OFFSET ${Number(this.row_offset)}`);
            this.row_count = Number((await this.sql.query(`SELECT COUNT(*) AS count FROM \`${this.options.db}\`.\`${this.options.table_name}\` ${this.where? "WHERE " + this.where : ''}`))[0]?.count);   
        } catch (e) {
            logger.error("SQL Error:", e);
            UIX.Actions.notification("SQL " + S('error'), e.toString().replaceAll("Error:", ""));
            return;
        }
        this.sendMessageUp("row_count", this.row_count);
        this.renderTable(fields, rows, this.order_by_column, this.desc);
        this.autoComplete(fields)
    }

    private static unregister_last_auto_complete: Function
    
    // Monaco auto complete
    private async autoComplete(fields: any[]) {

        // remove last autocomplete provider
        if (typeof DBTableView.unregister_last_auto_complete == "function") DBTableView.unregister_last_auto_complete()

        let field_names = [];
        for (let field of fields) field_names.push(field.COLUMN_NAME);
    
        await MonacoHandler.init()
        DBTableView.unregister_last_auto_complete =  MonacoHandler.monaco.languages.registerCompletionItemProvider('mysql', {
        provideCompletionItems: function(model, position) {
                let word = model.getWordUntilPosition(position);
                let range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                };
                let list = [];
                for (let name of field_names) {
                    list.push({
                        label: name,
                        kind: MonacoHandler.monaco.languages.CompletionItemKind.Module,
                        insertText: name,
                        range: range
                    })
                }
                return {suggestions: list};
            }
        }).dispose;
    }

    private async deleteRow(){
        UIX.Actions.dialog( S`delete_entry_confirm`, null, [{
            text: S('cancel'),
            onClick: () => {},
        },{
            color: 'var(--red)',
            text: S('delete'),
            onClick: async () => {
                if (!this.selected_row_pk_unique) {
                    UIX.Actions.notification(S('error'), S('delete_error'));
                    return;
                }


                let where_statements = [];
                let values = [];
                for (let [name, value] of this.selected_row_pk_unique) {
                    if (value == null) where_statements.push(`\`${name}\` IS NULL`);
                    else {
                        where_statements.push(`\`${name}\`=?`);
                        values.push(value)
                    }
                }

                const query = "DELETE FROM `" + this.options.table_name + "` WHERE " + where_statements.join(" AND ");
                console.log("delete",query,values)
                let res:any = await this.sql.query(query, values);
                console.log("res",res)
                if (res?.affectedRows == 1) {
                    this.selected_row?.remove(); // remove row
                    this.selected_row = null;
                    this.selected_row_pk_unique = null;
                    this.row_count--; // one row was removed, update internal 'row_count' accordingly
                    this.sendMessageUp("row_count", this.row_count);
                }
                // more than 1 row was deleted with one request because they were exactly equal
                else if (res?.affectedRows > 1) {
                    UIX.Actions.notification("SQL Warning", "More than one row was deleted");
                    this.tableQuery();
                }
                else UIX.Actions.notification(S('error'), S('delete_error'));
            },
        }]);
    }


    private async saveChanges(){
        if (!this.sql) await this.connectToDatabase();
        if (!this.updated_columns.size) return;

        console.log("saving table changes", this.updated_columns);

        try {
            // create SQL query
            let promises = [];
            for (let [where, what] of this.updated_columns) {
                let update_statements = [];
                let where_statements = [];
                let values = [];

                for (let [name, value] of Object.entries(what)) {
                    update_statements.push(`\`${name}\`=?`);
                    values.push(value)
                }

                for (let [name, value] of where) {
                    if (value == null) where_statements.push(`\`${name}\` IS NULL`);
                    else {
                        where_statements.push(`\`${name}\`=?`);
                        values.push(value)
                    }
                }
    
                const query = `UPDATE \`${this.options.table_name}\` SET ${update_statements.join(", ")} WHERE ${where_statements.join(" AND ")}`;
                console.log(query, values)
                promises.push(this.sql.query(query, values));
            }

            // execute all in parallel
            await Promise.all(promises);

            this.updated_columns = new Map();
            this.removeFlag("error")
            this.removeFlag("dirty");
            this.tableQuery();
        }

        catch (e) {
            logger.error `${e}`;
            this.addFlag("error")
            UIX.Actions.notification(S('error'), e.toString().replaceAll("Error:", ""));
        }


    }

    private async insertRows() {
        if (!this.sql) await this.connectToDatabase();
        if (!this.insert_rows.length) return;

        try {
            // create SQL query
            const promises = [];
            for (const row of this.insert_rows) {
                promises.push(this.sql.query(`INSERT INTO \`${this.options.table_name}\` (${this.column_names.join(", ")}) VALUES (?)`, [row]));
            }
            // execute all in parallel
            await Promise.all(promises);

            this.insert_rows = [];
            this.removeFlag("error")
            this.removeFlag("dirty");
            this.tableQuery();
        }

        catch(e) {
            logger.error(e);
            this.addFlag("error")
            UIX.Actions.notification(S('error'), e.toString().replaceAll("Error:", ""));
        }

    }

    private async renderTable(fields: mysql_column[], rows: any[], order_by_column:string, desc:boolean){
               
        // reset
        this.selected_row_pk_unique = null;
        this.selected_row = null;


        this.table = document.createElement("table");

        let header = document.createElement("thead");
        this.body = document.createElement("tbody");
        let header_row = document.createElement("tr");

        let primary_keys = []
        let invisible_columns = []

        this.column_names = [];
        for (let column of fields) {
            this.column_names.push("`" + column.COLUMN_NAME  + "`"); // update column names (in right order)
            this.column_info[column.COLUMN_NAME] = column;
            if (column.COLUMN_KEY=="PRI") primary_keys.push(column.COLUMN_NAME);
            if (column.EXTRA=="INVISIBLE") invisible_columns.push(column.COLUMN_NAME);
            let sort_btn = UIX.Utils.createHTMLElement(`<span style="margin-left:4px;">${I`fa-sort`}</span>`);
            let th = UIX.Utils.createHTMLElement(`<th style="${column.COLUMN_KEY=="PRI"?"color:var(--light_blue);":(column.EXTRA=="INVISIBLE"?"color:var(--text_color_light);":"")}cursor: pointer"><div>${column.COLUMN_KEY=="PRI"? `<span style="margin-right: 6px;">${I`fa-key`}</span>`:""}<span style="flex:1">${column.COLUMN_NAME}</span></div></th>`);
            th.querySelector("div").append(sort_btn)
            header_row.append(th)

            let is_desc = (order_by_column == column.COLUMN_NAME && !desc) // switch asc / desc
            th.addEventListener("click", ()=>{
                this.order_by_column = column.COLUMN_NAME;
                this.desc = is_desc;
                this.tableQuery();
            })

        }

        header.append(header_row);
        this.table.append(header);
        this.table.append(this.body);

        this.updated_columns = new Map();

        for (let row of rows) {
            this.createRow(row, primary_keys, invisible_columns, this.column_info);
        }

        // + row
        let add_row = {};
        for (let name of Object.keys(this.column_info)) {
            add_row[name] = null;
        }

        this.createRow(add_row, primary_keys, invisible_columns, this.column_info, true);

        UIX.Utils.addDelegatedEventListener(this.table, 'keydown paste', 'td', (e:KeyboardEvent) => {
            const el = <HTMLElement> e.target;
            var cntMaxLength = parseInt(el.getAttribute('data-maxlength'));
            if (el.innerText.length === cntMaxLength && e.code != "Backspace") {
                e.preventDefault();
            }
        });

        UIX.Utils.addDelegatedEventListener(this.table, "keypress", "td.number, td.boolean", (e:KeyboardEvent) => {
            let x = e.key;
            // @ts-ignore
            if (x==" " || (x!="-" && isNaN(String.fromCharCode(e.which)))) e.preventDefault();
        });

        UIX.Utils.addDelegatedEventListener(this.table, "keypress", "td.decimal", (e:KeyboardEvent) => {
            let x = e.code;
            // @ts-ignore
            if ((e.target.innerText.includes(".") && x==46) || x==32 || (isNaN(String.fromCharCode(e.which)) && x!=46)) e.preventDefault();
        });

        this.content.innerHTML = "";
        this.content.append(this.makeScrollContainer(this.table));
    }



    private str2ab(str:string) {
        if (!str) return new Uint8Array();

        const buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
        const bufView = new Uint16Array(buf);
        for (let i=0, strLen=str.length; i < strLen; i++) {
          bufView[i] = str.charCodeAt(i);
        }
        return new Uint8Array(buf);
    }

    private ab2str(buf:ArrayBuffer) {
        return String.fromCharCode.apply(null, <any>new Uint16Array(buf));
      }

    private createRow(row:object, primary_keys:string[], invisible_columns:string[], column_info:{[name:string]:mysql_column}, is_insert_row = false) {

        let row_el = document.createElement("tr");

        let added_new_row_below = false;

        if (is_insert_row) {
            row_el.addEventListener("keydown", ()=>{
                if (added_new_row_below) return;
                added_new_row_below = true;
                this.createRow(row, primary_keys, invisible_columns, column_info, true);
            })
        }

        let insert_row:any[];

        // Primary key selection condition
        let pk_unique_ar:pk_unique = [];
        for (let pk of primary_keys) {
            pk_unique_ar.push([pk, row[pk]]);/*"`"+pk+"`" + (
            row[pk] == null ? " IS NULL" : ("=" + (typeof row[pk] == "string" ? `"${row[pk].replaceAll('"', '\"')}"` : row[pk]))));*/
        }
        // no primary keys - selection condition based on all available fields
        // TODO could still select multiple entries if they are exactly the same!?
        if (!pk_unique_ar.length) {
            for (let [name, entry] of Object.entries(row)) {
                pk_unique_ar.push([name, entry]);/*"`"+name+"`" + (
                entry == null ? " IS NULL" : ("=" + (typeof entry == "string" ? `"${entry.replaceAll('"', '\"')}"` : entry))));*/
            }
        }
        //let pk_unique = pk_unique_ar.join(" AND ");

        let c = 0;

        // handle row selecte
        row_el.addEventListener("mousedown", ()=>{
            this.selected_row_pk_unique = pk_unique_ar;
            this.selected_row = row_el;
            this.table.querySelector("tr").classList.remove("selected")
            row_el.classList.add("selected")
        })


        for (let [name, entry] of Object.entries(row)) {
            if (!column_info[name]) {
                logger.error("Invalid entry name: " + name);
                continue;
            }
            let type = column_info[name].DATA_TYPE;
            let special_style = ""
            let is_json = false;
            let is_nullable = column_info[name].IS_NULLABLE == "YES";
            let is_date = false;
            let is_date_time = false;
            let is_buffer = false;
            let max_length = column_info[name].CHARACTER_MAXIMUM_LENGTH ?? 99999999999;

            if (type == "int" || type == "smallint" || type == "bigint" || type == "year") special_style = "number";
            else if (type == "float" || type == "double" || type == "decimal") special_style = "decimal";
            else if (type == "varchar" || type == "text") special_style = "string";
            else if (type == "tinyint" || type == "boolean" || type == "bit") special_style = "boolean";
            else if (type == "binary" || type == "blob" || type == 'tinyblob' || type == 'mediumblob' || type == 'longblob' || type == "varbinary") is_buffer = true;
            else if (type == "json") is_json = true;
            else if (type == "date") is_date = true;
            else if (type == "timestamp" || type == "datetime") is_date_time = true;


            if (is_json) {} // TODO
            else if (is_date) {
                special_style = ""
                const val = entry??"0000-00-00";
                entry = `<input type="date" style="color:var(--text)" value="${val}"/>`
            }
            else if (is_date_time) {
                special_style = ""
                entry = `<input type="datetime-local" style="color:var(--text)" value="${(entry instanceof Date ? (isNaN(entry.getTime()) ? "0000-00-00T00:00" : entry.toISOString()?.slice(0, 16)) : (entry?.replace(" ", "T").slice(0, 16))) ?? ""}"/>`;
            }
            else if (is_buffer) {
                special_style = "buffer"
                
                entry = `<span style='font-size:14px;font-family:Menlo, Monaco, "Courier New", monospace'>${Datex.buffer2hex(this.str2ab(entry))}</span>`
            }

            entry = entry??"";
            let td = UIX.Utils.createHTMLElement(`<td spellcheck="false" ${(is_date_time||is_date) ? '' : 'contenteditable="true"'}  data-maxlength="${max_length}"  class="${special_style}">${entry}</td>`);

            if (is_insert_row) {
                td.classList.add("new-row")
            }

            let _c = c;

            const changeHandler = ()=>{

                // get text or other value
                let new_value:unknown = td.innerText;
                if (new_value == "" && is_nullable) new_value = null;
                else if (is_date||is_date_time) new_value = new Date(<string>td.querySelector('input')?.value);//.value.replace("T", " ");
                else if (is_buffer) new_value = this.ab2str(Datex.hex2buffer(<string>new_value).buffer);

                console.log("change value", new_value,td.querySelector('input'))

                // insert new row
                if (is_insert_row) {
                    // add insert array if not yet created
                    if (!insert_row) {
                        insert_row = new Array(Object.keys(row).length).fill(null);
                        this.insert_rows.push(insert_row);
                    }

                    insert_row[_c] = new_value;
                    if (insert_row[_c] == "") delete insert_row[_c];
                    if (this.updated_columns.size || insert_row?.flat().length) this.addFlag("dirty")
                    else {
                        this.removeFlag("dirty")
                        this.removeFlag("error")
                    }
                    return;
                }

                // update value (has changed)
                if (new_value!=entry) {
                    td.classList.add("edited-row")
                    if (!this.updated_columns.get(pk_unique_ar)) this.updated_columns.set(pk_unique_ar, {});
                    this.updated_columns.get(pk_unique_ar)[name] = new_value;
                }

                else {
                    td.classList.remove("edited-row")
                    delete this.updated_columns.get(pk_unique_ar)[name];
                    if (!Object.keys(this.updated_columns.get(pk_unique_ar)).length) this.updated_columns.delete(pk_unique_ar);
                }

                if (this.updated_columns.size || insert_row?.flat().length) this.addFlag("dirty")
                else {
                    this.removeFlag("dirty")
                    this.removeFlag("error")
                }
                console.log(this.updated_columns);
            };

            // entry edited
            td.addEventListener("input", changeHandler)
            td.addEventListener("change", changeHandler)

            // custom context menu for row
            UIX.Handlers.contextMenu(td, {
                save_changes: {
                    text: S`save_changes`,
                    shortcut: 'save',
                    handler: ()=>{
                        this.insertRows();
                        this.saveChanges();
                    },
                    disabled:()=>!this.updated_columns || (this.updated_columns.size ? false : true) // TODO function handling
                },
                delete_entry: {
                    text: S`delete_entry`,
                    shortcut: 'meta_delete',
                    handler: ()=>this.deleteRow()
                }
            })

            row_el.append(td)
            c++;
        }

        this.body.append(row_el);
    }

}



/* QUERY VIEW & TABLE VIEW*/
@UIX.Id("xxx")
@UIX.Group("MySQL")
@UIX.Component<DB_TABLE_VIEW_OPTIONS>({icon:'fa-table', vertical_align:UIX.Types.VERTICAL_ALIGN.TOP, border:null, enable_drop:false})
export class DBExtendedTableView<O extends DB_TABLE_VIEW_OPTIONS = DB_TABLE_VIEW_OPTIONS> extends UIX.Components.FlexGroup<O> {

    // // @implement
    // onInit() {
    //     this.id = this.options.database + "/" + this.options.table_name;
    // }
    
    override onAssemble() {
        const query_view = new DBQueryView({id:'query_view', enable_drop:false, endpoint: this.options.endpoint}, {dynamic_size:true, margin_bottom:5, margin_top:5});
        const table_view = new DBTableView<DB_TABLE_VIEW_OPTIONS>({
            id: 'table_view',
            db: this.options.db,
            table_name: this.options.table_name,
            hostname: this.options.hostname,
            username: this.options.username,
            password: this.options.password,
            enable_drop:false,
            endpoint: this.options.endpoint
        });
        this.addChild(query_view);
        this.addChild(table_view);
    }

    override onReady(){
        this.title = this.options.table_name;

        const query_view = this.getElementByIdentifier('query_view');
        const table_view = this.getElementByIdentifier('table_view');

        this.redirectMessages(query_view, table_view, "query");
        this.redirectMessages(query_view, table_view, "export");
        this.redirectMessages(query_view, table_view, "import");
        this.redirectMessages(table_view, query_view, "row_count");
        this.redirectMessages(query_view, table_view, "delete");
    }

}

type TABLE_DATA = {
    type: string,
    name: string,
    invisible?: boolean,
    pk?: boolean
}

@UIX.Group("MySQL")
@UIX.Id("xxx")
@UIX.Component({
    accent_color:'#cccccc', 
    border_color:'#cccccc', 
    fade_connectors:true
})
export class TableNodeElement<O extends UIX.Components.Node.Options = UIX.Components.Node.Options> extends UIX.Components.Node<O> {

    add_btn: HTMLElement;

}

@UIX.Group("MySQL")
@UIX.Id("xxx")
@UIX.Component<DB_STRUCTURE_OPTIONS>({default_connection_options:{line_type:UIX.Components.Node.Connection.LINE_TYPE.ANGULAR}, bg_color:'var(--grey_blue)'})
export class DBStructureView<O extends DB_STRUCTURE_OPTIONS = DB_TABLE_VIEW_OPTIONS> extends UIX.Components.NodeGroup<O> {

    sql: SQLConnection;

    onInit(){
        this.title = this.options.db;
    }


    private async connectToDatabase() {
        this.sql = await SQL.to(this.options.endpoint??f('@+CODE')).connect({hostname:this.options.hostname!, password:this.options.password!, db:this.options.db!, username:this.options.username!, port:this.options.port!})
    }

    async addTable(table_info:any){
        if (!this.sql) await this.connectToDatabase();
        let table = new TableNodeElement({identifier: table_info.TABLE_NAME, title:table_info.TABLE_NAME});

        let columns:mysql_column[] = await this.sql.query(QUERY.GET_COLUMN_INFO, [this.options.db, table_info.TABLE_NAME]);
        
        // seperate primary keys from rest
        let pk_columns = []
        let i=0;
        for (let column of columns) {
            if (column.COLUMN_KEY == "PRI") pk_columns.push(columns.splice(i,1)[0]);
            i++;
        }
        columns = [...pk_columns, ...columns];

        for (let column of columns) {

            let data:TABLE_DATA = {
                name: column.COLUMN_NAME,
                type: column.COLUMN_TYPE,
                pk: column.COLUMN_KEY == "PRI"
            }
            if (column.EXTRA == "INVISIBLE") data.invisible = true;

            ///table.addItem(data, "both", data.name);
        } 
        await this.addChild(table)
    }

    async addTableConnections() {
        if (!this.sql) await this.connectToDatabase();
        let foreign_keys = await this.sql.query(QUERY.GET_DB_FOREIGN_KEYS, [this.options.db])
        //console.log("FOREIGN KEYS", foreign_keys);

        // for (let key of foreign_keys) {
        //     let in_connector = (<TableNodeElement>this.getElementByIdentifier(key.TABLE_NAME)).getConnector(key.COLUMN_NAME + "_left")
        //     let out_connector = (<TableNodeElement>this.getElementByIdentifier(key.REFERENCED_TABLE_NAME)).getConnector(key.REFERENCED_COLUMN_NAME +  "_right")
        //     this.createConnection(in_connector, out_connector);
        // }
        
    }

    async onAssemble(){
        this.connectToDatabase()
        
        globalThis.sql = this.sql;
        
        // get all tables
        let tables = await this.sql.query(QUERY.GET_TABLE_INFO, [this.options.db]);
        //console.log("TABLES", tables);
        await Promise.all(tables.map(table=>this.addTable(table)));

        // add connections between tables
        await this.addTableConnections();
    }

    
}


