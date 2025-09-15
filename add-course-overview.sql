-- Add course overview information to the courses table
-- Run this in your Supabase SQL Editor

ALTER TABLE courses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS study_topics TEXT[]; -- Array of study topics
ALTER TABLE courses ADD COLUMN IF NOT EXISTS learning_outcomes TEXT[]; -- Array of learning outcomes  
ALTER TABLE courses ADD COLUMN IF NOT EXISTS related_fields TEXT[]; -- Array of related fields (Robotics, Physics, etc.)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS career_paths TEXT[]; -- Array of career paths
ALTER TABLE courses ADD COLUMN IF NOT EXISTS top_companies JSONB; -- JSON object with japanese and international companies

-- Comprehensive data for all 22 courses

-- Mathematics & Engineering Fundamentals
UPDATE courses SET 
  description = 'Advanced mathematical course focusing on solving differential equations with one independent variable. Essential for engineering modeling and analysis.',
  study_topics = ARRAY['First-order differential equations', 'Second-order linear equations', 'Systems of differential equations', 'Laplace transforms', 'Series solutions', 'Numerical methods'],
  learning_outcomes = ARRAY['Solve various types of differential equations analytically', 'Apply Laplace transforms to solve complex problems', 'Model real-world engineering problems using differential equations', 'Implement numerical methods for approximate solutions'],
  related_fields = ARRAY['Mathematics', 'Engineering', 'Physics', 'Applied Sciences'],
  career_paths = ARRAY['Applied Mathematician', 'Research Engineer', 'Systems Engineer', 'Control Systems Engineer', 'Data Scientist', 'Quantitative Analyst'],
  top_companies = '{
    "japanese": ["Toyota Motor Corporation", "Sony Corporation", "Mitsubishi Heavy Industries"],
    "international": ["Google", "Microsoft", "Tesla", "Boeing", "Lockheed Martin", "NVIDIA", "Intel", "Apple", "Amazon"]
  }'::jsonb
WHERE short_name = 'ODE';

UPDATE courses SET 
  description = 'Study of material behavior under various loading conditions including stress, strain, and deformation analysis. Fundamental for mechanical and civil engineering.',
  study_topics = ARRAY['Stress and strain analysis', 'Material properties', 'Axial loading', 'Torsion of shafts', 'Bending of beams', 'Combined loading', 'Buckling analysis'],
  learning_outcomes = ARRAY['Analyze stress and strain in engineering materials', 'Design structural elements for safety and efficiency', 'Understand material failure mechanisms', 'Apply engineering mechanics principles to real structures'],
  related_fields = ARRAY['Mechanical Engineering', 'Civil Engineering', 'Materials Science', 'Structural Engineering'],
  career_paths = ARRAY['Mechanical Engineer', 'Civil Engineer', 'Structural Engineer', 'Materials Engineer', 'Design Engineer', 'Manufacturing Engineer'],
  top_companies = '{
    "japanese": ["Toyota Motor Corporation", "Honda Motor Co.", "Mitsubishi Heavy Industries", "Toshiba Corporation", "Hitachi Ltd.", "Kawasaki Heavy Industries"],
    "international": ["Boeing", "Airbus", "Caterpillar", "General Electric", "Siemens"]
  }'::jsonb
WHERE short_name = 'MoM';

UPDATE courses SET 
  description = 'Comprehensive introduction to C programming language covering fundamental concepts, data structures, and algorithm implementation for engineering applications.',
  study_topics = ARRAY['C syntax and semantics', 'Data types and variables', 'Control structures', 'Functions and procedures', 'Pointers and memory management', 'File I/O', 'Data structures'],
  learning_outcomes = ARRAY['Write efficient C programs for engineering problems', 'Understand memory management and pointers', 'Implement basic data structures and algorithms', 'Debug and optimize C code'],
  related_fields = ARRAY['Computer Science', 'Software Engineering', 'Embedded Systems', 'System Programming'],
  career_paths = ARRAY['Software Engineer', 'Embedded Systems Engineer', 'System Programmer', 'Firmware Engineer', 'Game Developer', 'Backend Developer'],
  top_companies = '{
    "japanese": ["Nintendo Co. Ltd.", "Sony Interactive Entertainment", "SoftBank Group"],
    "international": ["Google", "Microsoft", "Apple", "Intel", "NVIDIA", "Qualcomm", "ARM Holdings", "Tesla", "SpaceX"]
  }'::jsonb
WHERE short_name = 'C Prog';

UPDATE courses SET 
  description = 'Advanced study of electromagnetic fields, waves, and their applications in engineering systems including antennas, transmission lines, and wireless communications.',
  study_topics = ARRAY['Maxwell equations', 'Electromagnetic waves', 'Transmission lines', 'Waveguides', 'Antenna theory', 'Electromagnetic compatibility', 'RF circuit analysis'],
  learning_outcomes = ARRAY['Analyze electromagnetic field distributions', 'Design transmission line systems', 'Understand antenna radiation patterns', 'Solve wave propagation problems'],
  related_fields = ARRAY['Electrical Engineering', 'Communications Engineering', 'RF Engineering', 'Microwave Engineering'],
  career_paths = ARRAY['RF Engineer', 'Antenna Engineer', 'Communications Engineer', 'Microwave Engineer', 'Electromagnetic Compatibility Engineer', 'Wireless Systems Engineer'],
  top_companies = '{
    "japanese": ["NTT Corporation", "KDDI Corporation", "SoftBank Group", "Panasonic Corporation"],
    "international": ["Qualcomm", "Ericsson", "Nokia", "Samsung Electronics", "Huawei Technologies", "Cisco Systems", "Intel Corporation", "Broadcom Inc."]
  }'::jsonb
WHERE short_name = 'EMT';

-- Practical & Manufacturing
UPDATE courses SET 
  description = 'Hands-on training in traditional and modern machining techniques, precision manufacturing, and workshop safety practices essential for mechanical engineering.',
  study_topics = ARRAY['Lathe operations', 'Milling techniques', 'Drilling and boring', 'Grinding processes', 'CNC programming basics', 'Precision measurement', 'Workshop safety'],
  learning_outcomes = ARRAY['Operate various machine tools safely and effectively', 'Understand manufacturing tolerances and precision', 'Apply proper measurement techniques', 'Design manufacturable components'],
  related_fields = ARRAY['Mechanical Engineering', 'Manufacturing Engineering', 'Industrial Engineering', 'Production Technology'],
  career_paths = ARRAY['Manufacturing Engineer', 'Production Engineer', 'Quality Control Engineer', 'CNC Programmer', 'Tool and Die Maker', 'Industrial Engineer'],
  top_companies = '{
    "japanese": ["Toyota Motor Corporation", "Honda Motor Co.", "Nissan Motor Co.", "Mitsubishi Heavy Industries", "Kawasaki Heavy Industries", "IHI Corporation", "DMG Mori", "Okuma Corporation", "Fanuc Corporation", "Mazak Corporation"],
    "international": ["General Electric", "Siemens AG"]
  }'::jsonb
WHERE short_name = 'Machine Shop';

-- Life Skills & Personal Development
UPDATE courses SET 
  description = 'Comprehensive program focusing on physical fitness, team sports, leadership skills, and personal development through structured athletic and recreational activities.',
  study_topics = ARRAY['Team sports fundamentals', 'Individual fitness training', 'Leadership in sports', 'Health and wellness', 'Stress management', 'Goal setting'],
  learning_outcomes = ARRAY['Develop physical fitness and coordination', 'Build teamwork and leadership skills', 'Understand health and wellness principles', 'Apply stress management techniques'],
  related_fields = ARRAY['Physical Education', 'Health Sciences', 'Sports Management', 'Recreation'],
  career_paths = ARRAY['Sports Coach', 'Fitness Trainer', 'Physical Education Teacher', 'Sports Management Professional', 'Recreation Coordinator', 'Health and Wellness Consultant'],
  top_companies = '{
    "japanese": ["Konami Sports Club", "Renaissance Co. Ltd.", "Central Sports Co. Ltd.", "ASICS Corporation", "Mizuno Corporation", "Descente Ltd.", "Yonex Co. Ltd.", "Japanese Olympic Committee", "Japan Sports Agency"],
    "international": ["Nike Inc.", "Adidas AG", "Under Armour"]
  }'::jsonb
WHERE short_name = 'SLS 4';

-- Language Courses
UPDATE courses SET 
  description = 'Comprehensive Japanese language course covering fundamental grammar, vocabulary, reading, writing, and conversation skills for daily communication.',
  study_topics = ARRAY['Hiragana and Katakana', 'Basic Kanji characters', 'Grammar fundamentals', 'Daily conversation', 'Reading comprehension', 'Writing practice'],
  learning_outcomes = ARRAY['Communicate effectively in basic Japanese', 'Read and write fundamental Japanese texts', 'Understand Japanese cultural contexts', 'Apply language skills in daily situations'],
  related_fields = ARRAY['Japanese Language', 'Cultural Studies', 'International Relations', 'Translation'],
  career_paths = ARRAY['Translator', 'Interpreter', 'International Business Professional', 'Cultural Liaison', 'Language Teacher', 'Tourism Guide'],
  top_companies = '{
    "japanese": ["Japan Foundation", "Berlitz Corporation", "ECC Co. Ltd.", "Nova Corporation", "Toyota Motor Corporation", "Sony Corporation", "SoftBank Group", "Rakuten Group Inc.", "Fast Retailing Co. Ltd.", "Nintendo Co. Ltd.", "Embassy of Japan", "Japan External Trade Organization (JETRO)"],
    "international": []
  }'::jsonb
WHERE short_name = 'Japanese';

UPDATE courses SET 
  description = 'Specialized Japanese language course focusing on business communication, formal writing, keigo (honorific language), and professional interaction skills.',
  study_topics = ARRAY['Business keigo (honorific language)', 'Formal writing styles', 'Business meeting etiquette', 'Email communication', 'Presentation skills', 'Negotiation language'],
  learning_outcomes = ARRAY['Communicate professionally in Japanese business contexts', 'Write formal business documents in Japanese', 'Understand Japanese business culture and etiquette', 'Conduct meetings and presentations in Japanese'],
  related_fields = ARRAY['Business Administration', 'International Business', 'Japanese Studies', 'Corporate Communications'],
  career_paths = ARRAY['International Business Manager', 'Corporate Communications Specialist', 'Business Development Manager', 'Sales Representative', 'Account Manager', 'Cross-cultural Consultant'],
  top_companies = '{
    "japanese": ["Toyota Motor Corporation", "Sony Corporation", "SoftBank Group", "Rakuten Group Inc.", "Mitsubishi Corporation", "Mitsui & Co. Ltd.", "Itochu Corporation", "Marubeni Corporation", "Sumitomo Corporation", "Toyota Tsusho Corporation", "JETRO", "JICA"],
    "international": []
  }'::jsonb
WHERE short_name = 'Biz Japanese';

UPDATE courses SET 
  description = 'Advanced Japanese language course focusing on current events discussion, newspaper reading comprehension, and critical thinking through media analysis.',
  study_topics = ARRAY['Newspaper reading strategies', 'Current events analysis', 'Discussion techniques', 'Media literacy', 'Opinion expression', 'Debate skills'],
  learning_outcomes = ARRAY['Read and analyze Japanese newspapers effectively', 'Discuss current events in Japanese', 'Express opinions clearly and persuasively', 'Understand Japanese media and social issues'],
  related_fields = ARRAY['Journalism', 'Media Studies', 'Political Science', 'International Relations'],
  career_paths = ARRAY['Journalist', 'Media Analyst', 'International Correspondent', 'Political Analyst', 'Public Relations Specialist', 'Social Researcher'],
  top_companies = '{
    "japanese": ["NHK (Japan Broadcasting Corporation)", "Asahi Shimbun", "Yomiuri Shimbun", "Mainichi Shimbun", "Nikkei Inc.", "TV Asahi Corporation", "Fuji Television Network", "Kyodo News", "Jiji Press"],
    "international": ["Reuters", "Bloomberg", "Associated Press"]
  }'::jsonb
WHERE short_name = 'Disc/News Japanese';

-- Electrical & Electronics Engineering
UPDATE courses SET 
  description = 'Comprehensive study of electrical motor principles, design, control, and applications in industrial and automotive systems.',
  study_topics = ARRAY['DC motor fundamentals', 'AC motor theory', 'Motor control circuits', 'Power electronics for motors', 'Motor drive systems', 'Efficiency optimization'],
  learning_outcomes = ARRAY['Analyze motor performance characteristics', 'Design motor control systems', 'Understand power electronics applications', 'Optimize motor efficiency and performance'],
  related_fields = ARRAY['Electrical Engineering', 'Power Electronics', 'Control Systems', 'Automotive Engineering'],
  career_paths = ARRAY['Electrical Engineer', 'Motor Design Engineer', 'Power Electronics Engineer', 'Control Systems Engineer', 'Automotive Engineer', 'Energy Systems Engineer'],
  top_companies = '{
    "japanese": ["Toyota Motor Corporation", "Honda Motor Co.", "Nissan Motor Co.", "Panasonic Corporation", "Mitsubishi Electric", "Toshiba Corporation"],
    "international": ["Tesla Inc.", "General Electric", "Siemens AG", "ABB Ltd.", "Schneider Electric", "Emerson Electric Co."]
  }'::jsonb
WHERE short_name = 'Elec Motors';

-- Career & Professional Development
UPDATE courses SET 
  description = 'Comprehensive career planning course covering self-assessment, industry analysis, job search strategies, and professional development planning.',
  study_topics = ARRAY['Self-assessment and strengths analysis', 'Industry and career research', 'Resume and cover letter writing', 'Interview preparation', 'Networking strategies', 'Professional development planning'],
  learning_outcomes = ARRAY['Develop clear career goals and pathways', 'Create effective job search materials', 'Build professional networking skills', 'Understand industry trends and requirements'],
  related_fields = ARRAY['Human Resources', 'Career Counseling', 'Professional Development', 'Business Administration'],
  career_paths = ARRAY['Career Counselor', 'Human Resources Specialist', 'Recruitment Consultant', 'Professional Development Coach', 'Corporate Training Manager', 'Talent Acquisition Specialist'],
  top_companies = '{
    "japanese": ["Recruit Holdings Co. Ltd.", "Persol Holdings Co. Ltd.", "Temp Holdings Co. Ltd."],
    "international": ["LinkedIn Corporation", "Indeed Inc.", "Glassdoor Inc.", "ManpowerGroup Inc.", "Randstad N.V.", "Adecco Group", "Robert Half Inc.", "Kelly Services Inc.", "Hays plc"]
  }'::jsonb
WHERE short_name = 'Career';

-- Advanced Engineering Mathematics
UPDATE courses SET 
  description = 'Advanced mathematical methods including Fourier analysis, partial differential equations, and their applications in engineering problem solving.',
  study_topics = ARRAY['Fourier series and transforms', 'Partial differential equations', 'Heat equation', 'Wave equation', 'Laplace equation', 'Numerical methods for PDEs'],
  learning_outcomes = ARRAY['Apply Fourier analysis to engineering problems', 'Solve partial differential equations analytically', 'Model physical phenomena using mathematical methods', 'Use numerical techniques for complex problems'],
  related_fields = ARRAY['Applied Mathematics', 'Engineering Physics', 'Signal Processing', 'Computational Science'],
  career_paths = ARRAY['Applied Mathematician', 'Research Scientist', 'Signal Processing Engineer', 'Computational Engineer', 'Data Scientist', 'Quantitative Analyst'],
  top_companies = '{
    "japanese": ["Sony Corporation", "Panasonic Corporation", "Toshiba Corporation"],
    "international": ["Google", "Microsoft", "NVIDIA", "Intel", "Qualcomm", "MathWorks", "Wolfram Research", "IBM", "Amazon Web Services"]
  }'::jsonb
WHERE short_name = 'FAPDE';

-- Control & Automation
UPDATE courses SET 
  description = 'Advanced control theory covering modern control techniques, state-space methods, and digital control systems for engineering applications.',
  study_topics = ARRAY['State-space representation', 'Controllability and observability', 'Linear quadratic regulator', 'Kalman filtering', 'Digital control systems', 'Robust control'],
  learning_outcomes = ARRAY['Design modern control systems', 'Analyze system stability and performance', 'Implement digital control algorithms', 'Apply optimal control techniques'],
  related_fields = ARRAY['Control Engineering', 'Systems Engineering', 'Robotics', 'Automation'],
  career_paths = ARRAY['Control Systems Engineer', 'Automation Engineer', 'Robotics Engineer', 'Systems Engineer', 'Process Control Engineer', 'Instrumentation Engineer'],
  top_companies = '{
    "japanese": ["Toyota Motor Corporation", "Honda Motor Co.", "Fanuc Corporation", "Omron Corporation", "Keyence Corporation"],
    "international": ["ABB Ltd.", "Siemens AG", "Schneider Electric", "Emerson Electric Co.", "Honeywell International", "Rockwell Automation", "Yokogawa Electric Corporation"]
  }'::jsonb
WHERE short_name = 'MCE';

-- Measurement & Instrumentation
UPDATE courses SET 
  description = 'Comprehensive study of scientific measurement techniques, instrumentation systems, data acquisition, and experimental design for engineering research.',
  study_topics = ARRAY['Measurement principles', 'Sensor technology', 'Data acquisition systems', 'Signal conditioning', 'Measurement uncertainty', 'Experimental design'],
  learning_outcomes = ARRAY['Design measurement systems for engineering applications', 'Analyze measurement uncertainty and errors', 'Select appropriate sensors and instrumentation', 'Conduct reliable scientific experiments'],
  related_fields = ARRAY['Instrumentation Engineering', 'Measurement Science', 'Experimental Engineering', 'Quality Control'],
  career_paths = ARRAY['Instrumentation Engineer', 'Test Engineer', 'Quality Control Engineer', 'Research Scientist', 'Calibration Engineer', 'Metrology Engineer'],
  top_companies = '{
    "japanese": ["Yokogawa Electric Corporation", "Mitutoyo Corporation", "Keyence Corporation", "Omron Corporation"],
    "international": ["Agilent Technologies", "Keysight Technologies", "National Instruments", "Fluke Corporation", "Tektronix", "Honeywell International", "Emerson Electric Co.", "Endress+Hauser"]
  }'::jsonb
WHERE short_name = 'ISM';

-- Manufacturing & Production
UPDATE courses SET 
  description = 'Comprehensive introduction to production engineering covering manufacturing processes, quality control, lean manufacturing, and industrial automation.',
  study_topics = ARRAY['Manufacturing processes', 'Quality control systems', 'Lean manufacturing principles', 'Industrial automation', 'Production planning', 'Supply chain management'],
  learning_outcomes = ARRAY['Design efficient production systems', 'Implement quality control measures', 'Apply lean manufacturing techniques', 'Optimize production workflows'],
  related_fields = ARRAY['Manufacturing Engineering', 'Industrial Engineering', 'Operations Management', 'Quality Engineering'],
  career_paths = ARRAY['Manufacturing Engineer', 'Production Manager', 'Quality Engineer', 'Industrial Engineer', 'Process Improvement Engineer', 'Operations Manager'],
  top_companies = '{
    "japanese": ["Toyota Motor Corporation", "Honda Motor Co.", "Nissan Motor Co.", "Panasonic Corporation", "Sony Corporation", "Hitachi Ltd."],
    "international": ["General Electric", "Siemens AG", "3M Company", "Boeing Company", "Caterpillar Inc.", "John Deere"]
  }'::jsonb
WHERE short_name = 'IPE';

-- Chemistry & Materials
UPDATE courses SET 
  description = 'Advanced study of electrochemical principles, battery technology, corrosion science, and electroplating processes for engineering applications.',
  study_topics = ARRAY['Electrochemical fundamentals', 'Battery technology', 'Fuel cells', 'Corrosion mechanisms', 'Electroplating processes', 'Energy storage systems'],
  learning_outcomes = ARRAY['Understand electrochemical reaction mechanisms', 'Design battery and fuel cell systems', 'Analyze corrosion and protection methods', 'Apply electrochemical principles to energy systems'],
  related_fields = ARRAY['Electrochemistry', 'Materials Science', 'Energy Engineering', 'Chemical Engineering'],
  career_paths = ARRAY['Electrochemical Engineer', 'Battery Engineer', 'Materials Scientist', 'Energy Systems Engineer', 'Corrosion Engineer', 'Research Scientist'],
  top_companies = '{
    "japanese": ["Panasonic Corporation", "Sony Corporation", "Toyota Motor Corporation"],
    "international": ["Tesla Inc.", "Samsung SDI", "LG Chem", "CATL", "BYD Company", "Johnson Controls", "Saft Groupe", "Duracell", "Energizer Holdings"]
  }'::jsonb
WHERE short_name = 'Electrochem';

-- Signal Processing & Communications
UPDATE courses SET 
  description = 'Advanced digital signal processing covering algorithm design, filter implementation, and applications in communications and multimedia systems.',
  study_topics = ARRAY['Digital filter design', 'Fast Fourier Transform', 'Z-transform analysis', 'Multirate signal processing', 'Adaptive filtering', 'DSP implementation'],
  learning_outcomes = ARRAY['Design digital filters for various applications', 'Implement DSP algorithms efficiently', 'Analyze signals in frequency domain', 'Apply signal processing to real-world problems'],
  related_fields = ARRAY['Signal Processing', 'Communications Engineering', 'Computer Engineering', 'Audio Engineering'],
  career_paths = ARRAY['Signal Processing Engineer', 'DSP Engineer', 'Communications Engineer', 'Audio Engineer', 'Image Processing Engineer', 'Software Engineer'],
  top_companies = '{
    "japanese": ["Sony Corporation", "Panasonic Corporation", "Toshiba Corporation"],
    "international": ["Qualcomm", "Broadcom", "Texas Instruments", "Analog Devices", "NVIDIA", "Intel", "Apple", "Samsung Electronics", "Huawei Technologies"]
  }'::jsonb
WHERE short_name = 'DSP';

-- Laboratory & Research
UPDATE courses SET 
  description = 'Hands-on laboratory experience in mechatronics systems focusing on energy applications, sensor integration, and automated control systems.',
  study_topics = ARRAY['Sensor interfacing', 'Actuator control', 'Energy conversion systems', 'Data logging and analysis', 'System integration', 'Safety protocols'],
  learning_outcomes = ARRAY['Design and build mechatronic systems', 'Integrate sensors and actuators effectively', 'Implement energy-efficient control strategies', 'Analyze experimental data scientifically'],
  related_fields = ARRAY['Mechatronics', 'Energy Engineering', 'Automation', 'Robotics'],
  career_paths = ARRAY['Mechatronics Engineer', 'Automation Engineer', 'Energy Systems Engineer', 'Robotics Engineer', 'Control Systems Engineer', 'R&D Engineer'],
  top_companies = '{
    "japanese": ["Toyota Motor Corporation", "Honda Motor Co.", "Fanuc Corporation", "Mitsubishi Electric", "Omron Corporation", "Keyence Corporation", "Kawasaki Heavy Industries"],
    "international": ["ABB Ltd.", "Siemens AG", "Tesla Inc.", "Boston Dynamics", "KUKA AG"]
  }'::jsonb
WHERE short_name = 'MechLab(E)';

-- Project-Based Learning
UPDATE courses SET 
  description = 'Preparatory capstone project course involving research, design, and development of engineering solutions under faculty guidance.',
  study_topics = ARRAY['Project planning and management', 'Literature review techniques', 'Research methodology', 'Design thinking', 'Prototype development', 'Technical documentation'],
  learning_outcomes = ARRAY['Manage engineering projects effectively', 'Conduct thorough literature reviews', 'Apply engineering design principles', 'Develop working prototypes'],
  related_fields = ARRAY['Project Management', 'Engineering Design', 'Research Methodology', 'Innovation'],
  career_paths = ARRAY['Project Manager', 'R&D Engineer', 'Design Engineer', 'Product Development Engineer', 'Innovation Manager', 'Technical Consultant'],
  top_companies = '{
    "japanese": ["Toyota Motor Corporation", "Sony Corporation", "Panasonic Corporation"],
    "international": ["Google", "Microsoft", "Apple", "Tesla Inc.", "SpaceX", "Boston Consulting Group", "McKinsey & Company", "Accenture", "Deloitte", "PwC", "EY"]
  }'::jsonb
WHERE short_name = 'PreCap 2';

-- Robotics & Automation
UPDATE courses SET 
  description = 'Advanced study of robotic manipulator kinematics, dynamics, control, and path planning for industrial and service robot applications.',
  study_topics = ARRAY['Robot kinematics', 'Inverse kinematics solutions', 'Jacobian analysis', 'Trajectory planning', 'Robot dynamics', 'Control algorithms'],
  learning_outcomes = ARRAY['Analyze robot kinematics and dynamics', 'Design robot control systems', 'Plan optimal robot trajectories', 'Program industrial robot systems'],
  related_fields = ARRAY['Robotics', 'Automation', 'Mechanical Engineering', 'Control Systems'],
  career_paths = ARRAY['Robotics Engineer', 'Automation Engineer', 'Mechatronics Engineer', 'Control Systems Engineer', 'Manufacturing Engineer', 'R&D Engineer'],
  top_companies = '{
    "japanese": ["Fanuc Corporation", "Toyota Motor Corporation", "Honda Motor Co.", "SoftBank Robotics"],
    "international": ["ABB Ltd.", "KUKA AG", "Universal Robots", "Boston Dynamics", "iRobot Corporation", "Intuitive Surgical", "Tesla Inc.", "Amazon Robotics"]
  }'::jsonb
WHERE short_name = 'RobManip';

-- Electronics & Circuit Design
UPDATE courses SET 
  description = 'Advanced analog electronic circuit design covering operational amplifiers, filters, oscillators, and power management circuits.',
  study_topics = ARRAY['Operational amplifier circuits', 'Active filters', 'Oscillator design', 'Power amplifiers', 'Voltage regulators', 'Circuit simulation'],
  learning_outcomes = ARRAY['Design analog electronic circuits', 'Analyze circuit performance using simulation tools', 'Implement practical electronic systems', 'Troubleshoot analog circuits'],
  related_fields = ARRAY['Electronics Engineering', 'Circuit Design', 'Analog Engineering', 'Power Electronics'],
  career_paths = ARRAY['Analog Circuit Designer', 'Electronics Engineer', 'Hardware Engineer', 'Power Electronics Engineer', 'Test Engineer', 'R&D Engineer'],
  top_companies = '{
    "japanese": ["Sony Corporation", "Panasonic Corporation", "Toshiba Corporation", "Renesas Electronics"],
    "international": ["Texas Instruments", "Analog Devices", "Maxim Integrated", "Linear Technology", "Infineon Technologies", "STMicroelectronics", "Qualcomm", "Broadcom"]
  }'::jsonb
WHERE short_name = 'AEC';

-- Power Systems & Energy
UPDATE courses SET 
  description = 'Advanced power electronic systems covering power conversion, motor drives, renewable energy systems, and smart grid technologies.',
  study_topics = ARRAY['Power semiconductor devices', 'DC-DC converters', 'AC-DC rectifiers', 'Inverter circuits', 'Motor drive systems', 'Renewable energy integration'],
  learning_outcomes = ARRAY['Design power electronic converters', 'Analyze power system efficiency', 'Implement motor drive systems', 'Integrate renewable energy sources'],
  related_fields = ARRAY['Power Electronics', 'Energy Systems', 'Electrical Engineering', 'Renewable Energy'],
  career_paths = ARRAY['Power Electronics Engineer', 'Energy Systems Engineer', 'Electrical Engineer', 'Renewable Energy Engineer', 'Grid Integration Engineer', 'Power System Analyst'],
  top_companies = '{
    "japanese": ["Mitsubishi Electric", "Toshiba Corporation"],
    "international": ["Tesla Inc.", "General Electric", "Siemens AG", "ABB Ltd.", "Schneider Electric", "SolarEdge Technologies", "Enphase Energy", "First Solar", "Vestas Wind Systems", "Goldwind Science & Technology"]
  }'::jsonb
WHERE short_name = 'PEE';
