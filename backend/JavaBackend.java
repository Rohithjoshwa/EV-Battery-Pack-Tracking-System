import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.*;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class JavaBackend {
    static int PORT = 5000;
    static List<Map<String,Object>> users = new ArrayList<>();
    static List<Map<String,Object>> batteries = new ArrayList<>();
    static List<Map<String,Object>> history = new ArrayList<>();
    static List<Map<String,Object>> suppliers = new ArrayList<>();
    static List<Map<String,Object>> maintenance = new ArrayList<>();

    public static void main(String[] args) throws Exception {
        seed();
        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.createContext("/api", JavaBackend::handle);
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();
        System.out.println("Java backend running: http://localhost:" + PORT);
        System.out.println("Login: admin@evtrack.com / 1234");
    }

    static void handle(HttpExchange ex) throws IOException {
        addCors(ex);
        if ("OPTIONS".equalsIgnoreCase(ex.getRequestMethod())) { send(ex, 204, ""); return; }
        try {
            String method = ex.getRequestMethod();
            String path = ex.getRequestURI().getPath().replaceFirst("^/api", "");
            String body = readBody(ex);
            Map<String,String> json = parseJson(body);

            if (method.equals("GET") && path.equals("/health")) sendJson(ex, 200, "{\"ok\":true,\"storage\":\"java-memory\"}");
            else if (method.equals("POST") && path.equals("/auth/login")) login(ex, json);
            else if (method.equals("POST") && path.equals("/auth/register")) register(ex, json);
            else if (method.equals("POST") && path.equals("/generate-pack-id")) generatePackId(ex, json);
            else if (method.equals("GET") && path.equals("/battery")) listBattery(ex);
            else if (method.equals("POST") && path.equals("/battery")) addBattery(ex, json);
            else if (method.equals("PUT") && path.matches("/battery/\\d+")) updateBattery(ex, path, json);
            else if (method.equals("DELETE") && path.matches("/battery/\\d+")) deleteBattery(ex, path);
            else if (method.equals("GET") && path.matches("/battery/\\d+/history")) batteryHistory(ex, path);
            else if (method.equals("GET") && path.equals("/dashboard")) dashboard(ex);
            else if (method.equals("GET") && path.equals("/alerts")) alerts(ex);
            else if (method.equals("GET") && path.equals("/suppliers")) sendJson(ex, 200, toJson(sortDesc(suppliers)));
            else if (method.equals("POST") && path.equals("/suppliers")) addSupplier(ex, json);
            else if (method.equals("GET") && path.equals("/maintenance")) sendJson(ex, 200, toJson(sortDesc(maintenance)));
            else if (method.equals("POST") && path.equals("/maintenance")) addMaintenance(ex, json);
            else sendError(ex, 404, "API route not found");
        } catch (Exception e) {
            e.printStackTrace();
            sendError(ex, 500, "Java backend error: " + e.getMessage());
        }
    }

    static void seed() {
        String n = now();
        users.add(row("id",1,"name","Admin User","email","admin@evtrack.com","password","1234","role","Admin","created_at",n));
        batteries.add(row("id",1,"pack_id","EV-ALPHA-1001","model","Alpha 72V","voltage",72,"temperature",32,"soc",86,"soh",94,"status","Testing","defect_status","Good","remarks","Sample healthy pack","created_at",n,"updated_at",n));
        batteries.add(row("id",2,"pack_id","EV-BETA-1002","model","Beta 96V","voltage",96,"temperature",48,"soc",22,"soh",76,"status","Pack Assembly","defect_status","Good","remarks","Sample alert pack","created_at",n,"updated_at",n));
        suppliers.add(row("id",1,"name","VoltCell Components","contact","support@voltcell.com","material","Lithium cells","location","Coimbatore","created_at",n));
    }

    static void login(HttpExchange ex, Map<String,String> j) throws IOException {
        String email = val(j,"email").toLowerCase(), password = val(j,"password");
        for (Map<String,Object> u: users) {
            if (String.valueOf(u.get("email")).equalsIgnoreCase(email) && String.valueOf(u.get("password")).equals(password)) {
                Map<String,Object> safe = new LinkedHashMap<>(u); safe.remove("password");
                sendJson(ex, 200, "{\"message\":\"Login successful\",\"user\":" + toJson(safe) + "}"); return;
            }
        }
        sendError(ex, 401, "Authentication failed. Use admin@evtrack.com / 1234 or register a new account.");
    }
    static void register(HttpExchange ex, Map<String,String> j) throws IOException {
        if (val(j,"name").isEmpty() || val(j,"email").isEmpty() || val(j,"password").isEmpty()) { sendError(ex,400,"Name, email and password are required."); return; }
        for (Map<String,Object> u: users) if (String.valueOf(u.get("email")).equalsIgnoreCase(val(j,"email"))) { sendError(ex,409,"This email is already registered."); return; }
        Map<String,Object> u = row("id",nextId(users),"name",val(j,"name"),"email",val(j,"email"),"password",val(j,"password"),"role","User","created_at",now());
        users.add(u); Map<String,Object> safe = new LinkedHashMap<>(u); safe.remove("password");
        sendJson(ex, 201, "{\"message\":\"Registration successful\",\"user\":" + toJson(safe) + "}");
    }
    static void generatePackId(HttpExchange ex, Map<String,String> j) throws IOException {
        String model = val(j,"model").replaceAll("[^a-zA-Z0-9]", "");
        if (model.isEmpty()) model = "EV"; if (model.length() > 5) model = model.substring(0,5);
        String stamp = String.valueOf(System.currentTimeMillis()); stamp = stamp.substring(stamp.length()-6);
        sendJson(ex, 200, "{\"pack_id\":\"EV-" + esc(model.toUpperCase()) + "-" + stamp + "\"}");
    }
    static void listBattery(HttpExchange ex) throws IOException {
        String q = queryParam(ex, "search").toLowerCase();
        List<Map<String,Object>> rows = sortDesc(batteries);
        if (!q.isEmpty()) rows.removeIf(r -> !(contains(r,"pack_id",q)||contains(r,"model",q)||contains(r,"status",q)||contains(r,"defect_status",q)));
        sendJson(ex, 200, toJson(rows));
    }
    static void addBattery(HttpExchange ex, Map<String,String> j) throws IOException {
        String err = validateBattery(j); if (!err.isEmpty()) { sendError(ex,400,err); return; }
        for (Map<String,Object> b: batteries) if (String.valueOf(b.get("pack_id")).equals(val(j,"pack_id"))) { sendError(ex,409,"This Pack ID already exists. Generate a new ID."); return; }
        Map<String,Object> p = batteryFromJson(nextId(batteries), j, null); batteries.add(p); addHistory(p, "Battery pack created");
        sendJson(ex, 201, "{\"message\":\"Battery pack added successfully\",\"pack_id\":\""+esc(String.valueOf(p.get("pack_id")))+"\"}");
    }
    static void updateBattery(HttpExchange ex, String path, Map<String,String> j) throws IOException {
        int id = Integer.parseInt(path.split("/")[2]); String err = validateBattery(j); if (!err.isEmpty()) { sendError(ex,400,err); return; }
        for (int i=0;i<batteries.size();i++) if (((Number)batteries.get(i).get("id")).intValue()==id) {
            Map<String,Object> p = batteryFromJson(id,j,String.valueOf(batteries.get(i).get("pack_id"))); batteries.set(i,p); addHistory(p, val(j,"remarks").isEmpty()?"Battery status updated":val(j,"remarks"));
            sendJson(ex, 200, "{\"message\":\"Battery pack updated and tracking history saved\"}"); return;
        }
        sendError(ex,404,"Battery pack not found.");
    }
    static void deleteBattery(HttpExchange ex, String path) throws IOException {
        int id = Integer.parseInt(path.split("/")[2]); batteries.removeIf(b -> ((Number)b.get("id")).intValue()==id); history.removeIf(h -> ((Number)h.get("battery_id")).intValue()==id);
        sendJson(ex, 200, "{\"message\":\"Battery pack deleted\"}");
    }
    static void batteryHistory(HttpExchange ex, String path) throws IOException {
        int id = Integer.parseInt(path.split("/")[2]); List<Map<String,Object>> rows = new ArrayList<>();
        for (Map<String,Object> h: history) if (((Number)h.get("battery_id")).intValue()==id) rows.add(h);
        sendJson(ex, 200, toJson(sortDesc(rows)));
    }
    static void dashboard(HttpExchange ex) throws IOException {
        int total=batteries.size(), defective=0, ready=0, dispatched=0, alert=0; double soc=0,soh=0,temp=0;
        String[] statuses = {"Cell Inspection","Module Assembly","Pack Assembly","Testing","Ready for Dispatch","Dispatched"};
        List<Map<String,Object>> statusRows = new ArrayList<>();
        for (String s: statuses) { int c=0; for (Map<String,Object> p:batteries) if (s.equals(p.get("status"))) c++; statusRows.add(row("name",s,"value",c)); }
        for (Map<String,Object> p:batteries) { soc+=num(p,"soc"); soh+=num(p,"soh"); temp+=num(p,"temperature"); if("Defective".equals(p.get("defect_status"))) defective++; if("Ready for Dispatch".equals(p.get("status"))) ready++; if("Dispatched".equals(p.get("status"))) dispatched++; if(isAlert(p)) alert++; }
        List<Map<String,Object>> healthRows = new ArrayList<>(); for (Map<String,Object> p: sortDesc(batteries)) healthRows.add(row("pack_id",p.get("pack_id"),"soc",p.get("soc"),"soh",p.get("soh"),"temperature",p.get("temperature")));
        if (healthRows.size()>8) healthRows = healthRows.subList(0,8);
        Map<String,Object> d = row("totalPacks",total,"defectivePacks",defective,"readyPacks",ready,"dispatchedPacks",dispatched,"alertPacks",alert,"avgSoc",avg(soc,total),"avgSoh",avg(soh,total),"avgTemperature",avg(temp,total),"statusRows",statusRows,"healthRows",healthRows);
        sendJson(ex,200,toJson(d));
    }
    static void alerts(HttpExchange ex) throws IOException { List<Map<String,Object>> rows = new ArrayList<>(); for (Map<String,Object> p:batteries) if(isAlert(p)){ Map<String,Object> r=new LinkedHashMap<>(p); r.put("alert_message", alertMsg(p)); rows.add(r);} sendJson(ex,200,toJson(sortDesc(rows))); }
    static void addSupplier(HttpExchange ex, Map<String,String> j) throws IOException { if(val(j,"name").isEmpty()||val(j,"material").isEmpty()){sendError(ex,400,"Supplier name and material are required.");return;} Map<String,Object> r=row("id",nextId(suppliers),"name",val(j,"name"),"contact",val(j,"contact"),"material",val(j,"material"),"location",val(j,"location"),"created_at",now()); suppliers.add(r); sendJson(ex,201,"{\"message\":\"Supplier added\",\"id\":"+r.get("id")+"}"); }
    static void addMaintenance(HttpExchange ex, Map<String,String> j) throws IOException { if(val(j,"pack_id").isEmpty()||val(j,"service_type").isEmpty()){sendError(ex,400,"Pack ID and service type are required.");return;} Map<String,Object> r=row("id",nextId(maintenance),"pack_id",val(j,"pack_id"),"service_type",val(j,"service_type"),"engineer",val(j,"engineer"),"notes",val(j,"notes"),"created_at",now()); maintenance.add(r); sendJson(ex,201,"{\"message\":\"Maintenance record added\",\"id\":"+r.get("id")+"}"); }

    static Map<String,Object> batteryFromJson(int id, Map<String,String> j, String oldPackId) { String n=now(); return row("id",id,"pack_id",oldPackId==null?val(j,"pack_id"):oldPackId,"model",val(j,"model"),"voltage",dbl(j,"voltage"),"temperature",dbl(j,"temperature"),"soc",dbl(j,"soc"),"soh",dbl(j,"soh"),"status",val(j,"status"),"defect_status",val(j,"defect_status"),"remarks",val(j,"remarks"),"created_at",n,"updated_at",n); }
    static void addHistory(Map<String,Object> p, String remarks) { history.add(row("id",nextId(history),"battery_id",p.get("id"),"pack_id",p.get("pack_id"),"status",p.get("status"),"voltage",p.get("voltage"),"temperature",p.get("temperature"),"soc",p.get("soc"),"soh",p.get("soh"),"defect_status",p.get("defect_status"),"remarks",remarks,"created_at",now())); }
    static String validateBattery(Map<String,String> j) { List<String> e=new ArrayList<>(); if(val(j,"pack_id").isEmpty()) e.add("Pack ID is required."); if(val(j,"model").isEmpty()) e.add("Battery model is required."); for(String f: List.of("voltage","temperature","soc","soh")) try{Double.parseDouble(val(j,f));}catch(Exception ex){e.add(f+" must be a number.");} double soc=dbl(j,"soc"), soh=dbl(j,"soh"); if(soc<0||soc>100)e.add("SoC must be between 0 and 100."); if(soh<0||soh>100)e.add("SoH must be between 0 and 100."); return String.join(" ",e); }
    static boolean isAlert(Map<String,Object> p){ return "Defective".equals(p.get("defect_status")) || num(p,"temperature")>45 || num(p,"soh")<80 || num(p,"soc")<25; }
    static String alertMsg(Map<String,Object> p){ return "Defective".equals(p.get("defect_status")) ? "Defective battery pack detected" : num(p,"temperature")>45 ? "High temperature warning" : num(p,"soh")<80 ? "Low State of Health warning" : "Low State of Charge warning"; }

    static Map<String,Object> row(Object... kv) { Map<String,Object> m=new LinkedHashMap<>(); for(int i=0;i<kv.length;i+=2)m.put(String.valueOf(kv[i]),kv[i+1]); return m; }
    static int nextId(List<Map<String,Object>> rows){ int max=0; for(Map<String,Object> r:rows) max=Math.max(max, ((Number)r.get("id")).intValue()); return max+1; }
    static String now(){ return Instant.now().toString(); }
    static double num(Map<String,Object> m,String k){ return ((Number)m.get(k)).doubleValue(); }
    static double avg(double sum,int count){ return count==0?0:Math.round((sum/count)*100.0)/100.0; }
    static double dbl(Map<String,String> j,String k){ try{return Double.parseDouble(val(j,k));}catch(Exception e){return 0;} }
    static String val(Map<String,String> j,String k){ return j.getOrDefault(k,"").trim(); }
    static boolean contains(Map<String,Object> r,String k,String q){ return String.valueOf(r.getOrDefault(k,"")).toLowerCase().contains(q); }
    static List<Map<String,Object>> sortDesc(List<Map<String,Object>> in){ List<Map<String,Object>> out=new ArrayList<>(in); out.sort((a,b)->Integer.compare(((Number)b.get("id")).intValue(),((Number)a.get("id")).intValue())); return out; }

    static Map<String,String> parseJson(String s) { Map<String,String> m=new HashMap<>(); if(s==null)return m; Matcher mt=Pattern.compile("\\\"([^\\\"]+)\\\"\\s*:\\s*(\\\"((?:\\\\.|[^\\\"])*)\\\"|-?\\d+(?:\\.\\d+)?|true|false|null)").matcher(s); while(mt.find()) m.put(mt.group(1), mt.group(3)!=null ? mt.group(3).replace("\\\\\"","\"") : mt.group(2)); return m; }
    static String toJson(Object o){ if(o==null)return"null"; if(o instanceof String)return"\""+esc((String)o)+"\""; if(o instanceof Number||o instanceof Boolean)return String.valueOf(o); if(o instanceof Map){ StringBuilder sb=new StringBuilder("{"); boolean first=true; for(Object en:((Map<?,?>)o).entrySet()){ Map.Entry<?,?> e=(Map.Entry<?,?>)en; if(!first)sb.append(','); first=false; sb.append(toJson(String.valueOf(e.getKey()))).append(':').append(toJson(e.getValue())); } return sb.append('}').toString(); } if(o instanceof Iterable){ StringBuilder sb=new StringBuilder("["); boolean first=true; for(Object v:(Iterable<?>)o){ if(!first)sb.append(','); first=false; sb.append(toJson(v)); } return sb.append(']').toString(); } return toJson(String.valueOf(o)); }
    static String esc(String s){ return s.replace("\\","\\\\").replace("\"","\\\"").replace("\n","\\n").replace("\r",""); }
    static String readBody(HttpExchange ex) throws IOException { return new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8); }
    static String queryParam(HttpExchange ex,String key) throws UnsupportedEncodingException { String q=ex.getRequestURI().getRawQuery(); if(q==null)return""; for(String part:q.split("&")){String[] kv=part.split("=",2); if(URLDecoder.decode(kv[0],"UTF-8").equals(key)) return kv.length>1?URLDecoder.decode(kv[1],"UTF-8"):"";} return""; }
    static void addCors(HttpExchange ex){ ex.getResponseHeaders().add("Access-Control-Allow-Origin","*"); ex.getResponseHeaders().add("Access-Control-Allow-Methods","GET,POST,PUT,DELETE,OPTIONS"); ex.getResponseHeaders().add("Access-Control-Allow-Headers","Content-Type"); }
    static void sendJson(HttpExchange ex,int code,String json)throws IOException{ ex.getResponseHeaders().set("Content-Type","application/json"); send(ex,code,json); }
    static void sendError(HttpExchange ex,int code,String msg)throws IOException{ sendJson(ex,code,"{\"error\":\""+esc(msg)+"\"}"); }
    static void send(HttpExchange ex,int code,String text)throws IOException{ byte[] b=text.getBytes(StandardCharsets.UTF_8); ex.sendResponseHeaders(code,b.length); try(OutputStream os=ex.getResponseBody()){os.write(b);} }
}
